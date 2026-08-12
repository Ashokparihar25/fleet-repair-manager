import { emptyExtraction, normalizeExtraction } from "@/lib/ocr/parse";
import { isEmptyExtraction } from "@/lib/ocr/quality";
import { OCR_SYSTEM_PROMPT } from "@/lib/ocr/prompt";
import { pdfPageCount, splitPdfToPageBuffers } from "@/lib/ocr/split-pdf";
import type { OcrExtractionResult } from "@/types";

type GeminiExtractResult = { extractions: OcrExtractionResult[]; warning?: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGeminiJson(text: string): OcrExtractionResult[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const raw = JSON.parse(cleaned) as unknown;
  if (Array.isArray(raw)) return raw.map((item) => normalizeExtraction(item));
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.invoices)) return obj.invoices.map((item) => normalizeExtraction(item));
    if (Array.isArray(obj.extractions)) return obj.extractions.map((item) => normalizeExtraction(item));
    if (Array.isArray(obj.pages)) return obj.pages.map((item) => normalizeExtraction(item));
    return [normalizeExtraction(raw)];
  }
  return [emptyExtraction()];
}

function pickSingle(extractions: OcrExtractionResult[]): OcrExtractionResult {
  if (extractions.length <= 1) return extractions[0] ?? emptyExtraction();
  return extractions.find((e) => !isEmptyExtraction(e)) ?? extractions[0];
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function geminiGenerate(
  apiKey: string,
  parts: Array<Record<string, unknown>>,
  opts: { retries?: number } = {},
): Promise<{ text: string; warning?: string }> {
  const model = process.env.OCR_GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const retries = opts.retries ?? 4;
  let lastErr = "OCR provider error";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: OCR_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
        promptFeedback?: { blockReason?: string };
      };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
      if (!text) {
        lastErr = json.promptFeedback?.blockReason
          ? `OCR blocked: ${json.promptFeedback.blockReason}`
          : `OCR returned empty content (${json.candidates?.[0]?.finishReason || "no candidates"})`;
      } else {
        return { text };
      }
    } else {
      const errText = await res.text();
      lastErr = `OCR provider error (${res.status}): ${errText.slice(0, 300)}`;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === retries) break;
      await sleep(800 * Math.pow(2, attempt) + Math.floor(Math.random() * 400));
      continue;
    }

    if (attempt < retries) {
      await sleep(700 * Math.pow(2, attempt));
    }
  }

  return { text: "", warning: lastErr };
}

export async function geminiExtractInline(
  apiKey: string,
  bytes: Buffer,
  mime: string,
  opts: { singlePage?: boolean; pageHint?: number } = {},
): Promise<GeminiExtractResult> {
  const hint = opts.singlePage
    ? opts.pageHint
      ? `This attachment is page ${opts.pageHint} of a multi-page invoice PDF (single page file). Return ONE invoice JSON object only.`
      : "This file is a single invoice page. Return ONE invoice JSON object only — never an array of empty stubs."
    : mime.includes("pdf")
      ? "If this PDF has multiple invoice pages, return JSON {\"invoices\":[...]} with one object per invoice/page. Otherwise return a single invoice object."
      : "Extract all invoice data from this image as a single invoice JSON object.";

  const { text, warning } = await geminiGenerate(apiKey, [
    {
      text: `${hint} Keep parts and labor as separate arrays. Do not guess missing values. Always extract VIN when printed.`,
    },
    { inline_data: { mime_type: mime, data: bytes.toString("base64") } },
  ]);

  if (!text) {
    return { extractions: [emptyExtraction()], warning: warning || "OCR returned no text." };
  }
  try {
    const extractions = parseGeminiJson(text);
    if (opts.singlePage) return { extractions: [pickSingle(extractions)] };
    return { extractions };
  } catch {
    return { extractions: [emptyExtraction()], warning: "OCR returned unparseable output. Needs verification." };
  }
}

async function uploadGeminiFile(
  apiKey: string,
  bytes: Buffer,
  mime: string,
  displayName: string,
): Promise<{ uri: string; name: string }> {
  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.length),
        "X-Goog-Upload-Header-Content-Type": mime,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    },
  );
  if (!startRes.ok) {
    throw new Error(`Gemini file upload start failed: ${(await startRes.text()).slice(0, 300)}`);
  }
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini file upload did not return an upload URL.");

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(bytes),
  });
  if (!uploadRes.ok) {
    throw new Error(`Gemini file upload failed: ${(await uploadRes.text()).slice(0, 300)}`);
  }
  const uploaded = (await uploadRes.json()) as { file?: { uri?: string; name?: string; state?: string } };
  const uri = uploaded.file?.uri;
  const name = uploaded.file?.name;
  if (!uri || !name) throw new Error("Gemini file upload returned no file uri.");

  // Wait until ACTIVE (scanned PDFs can take a moment to process).
  for (let i = 0; i < 30; i++) {
    const metaRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`);
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as { state?: string; error?: { message?: string } };
      if (meta.state === "ACTIVE") return { uri, name };
      if (meta.state === "FAILED") {
        throw new Error(meta.error?.message || "Gemini failed to process uploaded PDF.");
      }
    }
    await sleep(1000);
  }
  throw new Error("Timed out waiting for Gemini to process the uploaded PDF.");
}

async function deleteGeminiFile(apiKey: string, name: string) {
  try {
    await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`, { method: "DELETE" });
  } catch {
    /* best-effort cleanup */
  }
}

async function extractPageFromFile(
  apiKey: string,
  fileUri: string,
  mime: string,
  page: number,
  totalPages: number,
): Promise<GeminiExtractResult> {
  const { text, warning } = await geminiGenerate(apiKey, [
    {
      text: `Extract invoice data from ONLY page ${page} of ${totalPages} in this PDF. Ignore other pages. Return ONE invoice JSON object for that page. If the page is blank or not an invoice, return null fields with overall_confidence 0.`,
    },
    { file_data: { mime_type: mime, file_uri: fileUri } },
  ]);

  if (!text) return { extractions: [emptyExtraction()], warning: warning || `Page ${page}: OCR returned no text.` };
  try {
    return { extractions: [pickSingle(parseGeminiJson(text))], warning };
  } catch {
    return { extractions: [emptyExtraction()], warning: `Page ${page}: OCR returned unparseable output.` };
  }
}

/** Prefer one Files API upload + per-page prompts; fall back to split inline PDFs. */
export async function geminiExtractPdfByPage(
  apiKey: string,
  bytes: Buffer,
): Promise<{ extractions: OcrExtractionResult[]; warning?: string; warnings: string[] }> {
  const totalPages = await pdfPageCount(bytes);
  if (totalPages <= 1) {
    const one = await geminiExtractInline(apiKey, bytes, "application/pdf", { singlePage: true, pageHint: 1 });
    return {
      extractions: one.extractions,
      warning: one.warning,
      warnings: one.warning ? [one.warning] : [],
    };
  }

  const concurrency = Math.max(1, Math.min(2, Number(process.env.OCR_PAGE_CONCURRENCY || 2)));

  try {
    const file = await uploadGeminiFile(apiKey, bytes, "application/pdf", `invoice-${Date.now()}.pdf`);
    try {
      const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
      const results = await mapPool(pageNumbers, concurrency, async (page) => {
        // Gentle pacing to reduce 429s on large batches.
        await sleep(150);
        const r = await extractPageFromFile(apiKey, file.uri, "application/pdf", page, totalPages);
        // Retry once more if empty and no hard warning about parse — often transient.
        if (isEmptyExtraction(r.extractions[0]) && !(r.warning || "").includes("unparseable")) {
          await sleep(500);
          const again = await extractPageFromFile(apiKey, file.uri, "application/pdf", page, totalPages);
          if (!isEmptyExtraction(again.extractions[0])) return { page, ...again };
        }
        return { page, ...r };
      });

      const extractions = results.map((r) => r.extractions[0] ?? emptyExtraction());
      const warnings = results
        .map((r) =>
          r.warning
            ? `Page ${r.page}: ${r.warning}`
            : isEmptyExtraction(r.extractions[0])
              ? `Page ${r.page}: little/no invoice data extracted`
              : null,
        )
        .filter((w): w is string => Boolean(w));
      const emptyCount = extractions.filter((e) => isEmptyExtraction(e)).length;
      return {
        extractions,
        warnings,
        warning:
          warnings[0] ||
          (emptyCount
            ? `Processed ${totalPages} pages via Gemini Files API; ${emptyCount} still need review.`
            : `Processed ${totalPages} pages via Gemini Files API.`),
      };
    } finally {
      await deleteGeminiFile(apiKey, file.name);
    }
  } catch (fileApiErr) {
    // Fallback: split PDF and send pages inline (slower / more rate-limit prone).
    const pageBuffers = await splitPdfToPageBuffers(bytes);
    const results = await mapPool(pageBuffers, 1, async (pageBytes, i) => {
      await sleep(250);
      let r = await geminiExtractInline(apiKey, pageBytes, "application/pdf", {
        singlePage: true,
        pageHint: i + 1,
      });
      if (isEmptyExtraction(r.extractions[0])) {
        await sleep(600);
        r = await geminiExtractInline(apiKey, pageBytes, "application/pdf", {
          singlePage: true,
          pageHint: i + 1,
        });
      }
      return { page: i + 1, ...r };
    });

    const extractions = results.map((r) => r.extractions[0] ?? emptyExtraction());
    const warnings = results
      .map((r) =>
        r.warning
          ? `Page ${r.page}: ${r.warning}`
          : isEmptyExtraction(r.extractions[0])
            ? `Page ${r.page}: little/no invoice data extracted`
            : null,
      )
      .filter((w): w is string => Boolean(w));
    const reason = fileApiErr instanceof Error ? fileApiErr.message : "Files API unavailable";
    return {
      extractions,
      warnings,
      warning: `Files API unavailable (${reason}). Fell back to per-page inline OCR. ${warnings[0] || ""}`.trim(),
    };
  }
}
