import { emptyExtraction, normalizeExtraction } from "@/lib/ocr/parse";
import { isEmptyExtraction } from "@/lib/ocr/quality";
import { OCR_SYSTEM_PROMPT } from "@/lib/ocr/prompt";
import { pdfPageCount, splitPdfToPageBuffers } from "@/lib/ocr/split-pdf";
import {
  availableGeminiModels,
  geminiModelChain,
  geminiPaceDelayMs,
  geminiPagesPerRequest,
  recordGeminiRequest,
} from "@/lib/ocr/gemini-usage";
import type { OcrExtractionResult } from "@/types";

type GeminiExtractResult = { extractions: OcrExtractionResult[]; warning?: string };

/** Thrown when every model in the chain is out of daily quota. */
export class GeminiQuotaError extends Error {
  readonly quotaExhausted = true;
}

/** Roughly 20 MB request cap on inline data; stay well under it. */
const INLINE_BYTE_BUDGET = 6_000_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maxOutputTokens() {
  const raw = Number(process.env.OCR_MAX_OUTPUT_TOKENS || 32768);
  return Math.max(2048, Math.min(65536, Number.isFinite(raw) && raw > 0 ? raw : 32768));
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

/** Page numbers Gemini labelled each object with, so results can be realigned. */
function parsePageLabels(text: string): Array<number | null> {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    const raw = JSON.parse(cleaned) as unknown;
    const list = Array.isArray(raw)
      ? raw
      : ((raw as Record<string, unknown>)?.invoices as unknown[]) ||
        ((raw as Record<string, unknown>)?.extractions as unknown[]) ||
        ((raw as Record<string, unknown>)?.pages as unknown[]) ||
        [raw];
    return list.map((item) => {
      const page = (item as Record<string, unknown>)?.page;
      return typeof page === "number" && Number.isFinite(page) ? page : null;
    });
  } catch {
    return [];
  }
}

function pickSingle(extractions: OcrExtractionResult[]): OcrExtractionResult {
  if (extractions.length <= 1) return extractions[0] ?? emptyExtraction();
  return extractions.find((e) => !isEmptyExtraction(e)) ?? extractions[0];
}

type QuotaFailure = {
  error?: {
    message?: string;
    details?: Array<{
      "@type"?: string;
      violations?: Array<{ quotaId?: string; quotaValue?: string }>;
      retryDelay?: string;
    }>;
  };
};

function readQuotaFailure(body: string) {
  try {
    const json = JSON.parse(body) as QuotaFailure;
    const details = json.error?.details ?? [];
    const violation = details.flatMap((d) => d.violations ?? [])[0];
    const retryDelayRaw = details.find((d) => d.retryDelay)?.retryDelay;
    const retryMs = retryDelayRaw ? Math.ceil(parseFloat(retryDelayRaw) * 1000) : null;
    const quotaId = violation?.quotaId ?? "";
    return {
      perDay: /PerDay/i.test(quotaId),
      limit: violation?.quotaValue ? Number(violation.quotaValue) : null,
      retryMs: Number.isFinite(retryMs) ? retryMs : null,
      message: json.error?.message ?? "",
    };
  } catch {
    return { perDay: false, limit: null, retryMs: null, message: body.slice(0, 200) };
  }
}

/**
 * Send one request, walking the model fallback chain when a model runs out of daily quota.
 * Daily quotas are per model, so the chain multiplies the free-tier allowance.
 */
async function geminiGenerate(
  apiKey: string,
  parts: Array<Record<string, unknown>>,
): Promise<{ text: string; model: string; warning?: string }> {
  const chain = geminiModelChain();
  const usable = await availableGeminiModels();
  const models = usable.length ? usable : chain;
  const exhausted: string[] = [];
  let lastErr = "OCR provider error";

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: OCR_SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
              maxOutputTokens: maxOutputTokens(),
            },
          }),
        });
      } catch (err) {
        lastErr = err instanceof Error ? err.message : "Network error calling Gemini";
        await sleep(1000 * (attempt + 1));
        continue;
      }

      if (res.ok) {
        await recordGeminiRequest({ model });
        const json = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
          promptFeedback?: { blockReason?: string };
        };
        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
        if (text) return { text, model };
        const finish = json.candidates?.[0]?.finishReason;
        lastErr = json.promptFeedback?.blockReason
          ? `Gemini blocked the page (${json.promptFeedback.blockReason})`
          : `Gemini returned empty content (${finish || "no candidates"})`;
        if (finish === "MAX_TOKENS") {
          lastErr = "Gemini hit the output token limit — try a smaller OCR_PAGE_BATCH.";
          break;
        }
        await sleep(800 * (attempt + 1));
        continue;
      }

      const body = await res.text();

      if (res.status === 429) {
        const quota = readQuotaFailure(body);
        await recordGeminiRequest({
          model,
          rateLimited: true,
          dailyExhausted: quota.perDay,
          observedLimit: quota.limit,
        });
        if (quota.perDay) {
          exhausted.push(`${model} (${quota.limit ?? "?"}/day)`);
          lastErr = `Daily quota used up for ${model}.`;
          break; // move to the next model
        }
        // Per-minute limit: wait out the window and retry the same model.
        await sleep(Math.min(65_000, Math.max(quota.retryMs ?? 0, geminiPaceDelayMs())));
        lastErr = `Rate limited on ${model}.`;
        continue;
      }

      await recordGeminiRequest({ model });

      if (res.status === 404) {
        lastErr = `Model ${model} is unavailable on this API key.`;
        break; // try the next model
      }
      if (res.status >= 500) {
        lastErr = `Gemini server error (${res.status}) on ${model}.`;
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }

      lastErr = `Gemini error (${res.status}): ${body.slice(0, 200)}`;
      break;
    }
  }

  if (exhausted.length === models.length) {
    throw new GeminiQuotaError(
      `Gemini free daily quota is used up on every configured model (${exhausted.join(", ")}). Quotas reset at midnight Pacific. Enable billing in Google AI Studio, or add more models to OCR_GEMINI_MODELS, to keep going now.`,
    );
  }

  return { text: "", model: models[models.length - 1], warning: lastErr };
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
      ? 'If this PDF has multiple invoice pages, return JSON {"invoices":[...]} with one object per invoice/page. Otherwise return a single invoice object.'
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

export type GeminiPdfBatchResult = {
  extractions: OcrExtractionResult[];
  warning?: string;
  warnings: string[];
  page_count: number;
  processed_from: number;
  processed_to: number;
  next_page: number | null;
  model?: string;
};

/**
 * OCR a range of invoice pages in ONE Gemini request.
 *
 * Per-page requests burned the whole free daily quota (20 requests/day/model) on a
 * single mid-size PDF, so pages came back blank. One batched request handles up to
 * `OCR_PAGE_BATCH` pages, keeping a 15-page PDF at ~3 requests.
 */
export async function geminiExtractPdfPages(
  apiKey: string,
  bytes: Buffer,
  opts: { pageFrom?: number; pageTo?: number } = {},
): Promise<GeminiPdfBatchResult> {
  const totalPages = await pdfPageCount(bytes);
  const batchSize = geminiPagesPerRequest();
  const pageFrom = Math.max(1, Math.min(totalPages, opts.pageFrom ?? 1));
  const requestedTo = Math.min(totalPages, opts.pageTo ?? pageFrom + batchSize - 1);

  if (totalPages === 1) {
    const one = await geminiExtractInline(apiKey, bytes, "application/pdf", { singlePage: true, pageHint: 1 });
    return {
      extractions: one.extractions,
      warning: one.warning,
      warnings: one.warning ? [one.warning] : [],
      page_count: 1,
      processed_from: 1,
      processed_to: 1,
      next_page: null,
    };
  }

  const allPages = await splitPdfToPageBuffers(bytes);

  // Trim the batch so the inline payload stays under Gemini's request size cap.
  const batch: Array<{ page: number; bytes: Buffer }> = [];
  let payloadBytes = 0;
  for (let page = pageFrom; page <= requestedTo; page++) {
    const pageBytes = allPages[page - 1];
    if (!pageBytes) break;
    const encoded = Math.ceil(pageBytes.length * 1.34);
    if (batch.length && payloadBytes + encoded > INLINE_BYTE_BUDGET) break;
    batch.push({ page, bytes: pageBytes });
    payloadBytes += encoded;
  }
  if (!batch.length) {
    const pageBytes = allPages[pageFrom - 1];
    if (pageBytes) batch.push({ page: pageFrom, bytes: pageBytes });
  }

  const pageTo = batch[batch.length - 1]?.page ?? pageFrom;
  const count = batch.length;

  const parts: Array<Record<string, unknown>> = [
    {
      text:
        `You are given ${count} single-page invoice PDFs, labeled PAGE ${pageFrom} through PAGE ${pageTo} (they are pages ${pageFrom}-${pageTo} of a ${totalPages}-page scan). ` +
        `Return JSON {"invoices":[...]} containing EXACTLY ${count} objects, one per attached page, in the same order. ` +
        `Add a "page" property to each object with its page number. Every object must follow the invoice schema. ` +
        `Never skip or merge pages: if a page is blank or unreadable, still return its object with null fields and overall_confidence 0. ` +
        `Keep parts and labor as separate arrays, and always extract the VIN when printed.`,
    },
  ];
  for (const item of batch) {
    parts.push({ text: `PAGE ${item.page}:` });
    parts.push({ inline_data: { mime_type: "application/pdf", data: item.bytes.toString("base64") } });
  }

  const { text, warning, model } = await geminiGenerate(apiKey, parts);

  let byPage = new Map<number, OcrExtractionResult>();
  let parseWarning = warning;

  if (text) {
    try {
      const parsed = parseGeminiJson(text);
      const labels = parsePageLabels(text);
      parsed.forEach((extraction, i) => {
        const label = labels[i];
        const page = label != null && label >= pageFrom && label <= pageTo ? label : batch[i]?.page;
        if (page != null && !byPage.has(page)) byPage.set(page, extraction);
      });
    } catch {
      byPage = new Map();
      parseWarning = "Gemini returned unparseable JSON for this batch.";
    }
  }

  // Retry stragglers one page at a time — usually 0, and capped so quota can't drain.
  const missing = batch.filter((item) => {
    const got = byPage.get(item.page);
    return !got || isEmptyExtraction(got);
  });
  const retryLimit = Math.max(0, Math.min(3, Number(process.env.OCR_PAGE_RETRY_LIMIT ?? 2)));
  for (const item of missing.slice(0, retryLimit)) {
    await sleep(geminiPaceDelayMs());
    try {
      const single = await geminiExtractInline(apiKey, item.bytes, "application/pdf", {
        singlePage: true,
        pageHint: item.page,
      });
      const got = single.extractions[0];
      if (got && !isEmptyExtraction(got)) byPage.set(item.page, got);
    } catch (err) {
      if (err instanceof GeminiQuotaError) break;
    }
  }

  const extractions = batch.map((item) => byPage.get(item.page) ?? emptyExtraction());
  const warnings = batch.map((item, i) =>
    isEmptyExtraction(extractions[i])
      ? `Page ${item.page}: ${parseWarning || "no invoice data could be read — verify manually"}`
      : "",
  );
  const emptyCount = extractions.filter((e) => isEmptyExtraction(e)).length;

  return {
    extractions,
    warnings: warnings.filter(Boolean),
    warning: emptyCount
      ? `Pages ${pageFrom}–${pageTo}: ${emptyCount} of ${count} need manual review.${parseWarning ? ` (${parseWarning})` : ""}`
      : undefined,
    page_count: totalPages,
    processed_from: pageFrom,
    processed_to: pageTo,
    next_page: pageTo < totalPages ? pageTo + 1 : null,
    model,
  };
}
