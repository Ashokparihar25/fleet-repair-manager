import { NextResponse } from "next/server";
import { OCR_SYSTEM_PROMPT } from "@/lib/ocr/prompt";
import { emptyExtraction, normalizeExtraction } from "@/lib/ocr/parse";
import { parseLalaInvoice } from "@/lib/ocr/lala-parser";
import { canRunLocalOcr, rasterizePdf, runLocalOcr } from "@/lib/ocr/local";
import type { OcrExtractionResult } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type OcrResponse = {
  extraction: OcrExtractionResult;
  extractions: OcrExtractionResult[];
  engine: "gemini" | "rapidocr" | "none";
  warning?: string;
  warnings?: string[];
  needs_review: boolean;
  page_count: number;
};

function payload(
  extractions: OcrExtractionResult[],
  extra: Partial<OcrResponse> = {},
): OcrResponse {
  const list = extractions.length ? extractions : [emptyExtraction()];
  const needs = list.some((e) => e.overall_confidence < 80) || Boolean(extra.warning);
  return {
    extraction: list[0],
    extractions: list,
    engine: extra.engine ?? "none",
    warning: extra.warning,
    warnings: extra.warnings,
    needs_review: extra.needs_review ?? needs,
    page_count: list.length,
  };
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

async function geminiExtract(
  apiKey: string,
  bytes: Buffer,
  mime: string,
): Promise<{ extractions: OcrExtractionResult[]; warning?: string }> {
  const model = process.env.OCR_GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const multiPageHint =
    mime.includes("pdf")
      ? "If this PDF has multiple invoice pages, return JSON {\"invoices\":[...]} with one object per invoice/page. Otherwise return a single invoice object."
      : "Extract all invoice data from this image as a single invoice JSON object.";

  const body = {
    system_instruction: { parts: [{ text: OCR_SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${multiPageHint} Keep parts and labor as separate arrays. Do not guess missing values.`,
          },
          { inline_data: { mime_type: mime, data: bytes.toString("base64") } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      extractions: [emptyExtraction()],
      warning: `OCR provider error: ${text.slice(0, 400)}`,
    };
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
  try {
    return { extractions: parseGeminiJson(text) };
  } catch {
    return {
      extractions: [emptyExtraction()],
      warning: "OCR returned unparseable output. Needs verification.",
    };
  }
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const isPdf = (file.type || "").includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
  const mime = isPdf ? "application/pdf" : file.type || "image/png";
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  try {
    if (apiKey) {
      // On Vercel, send PDF/images straight to Gemini (no local Python rasterizer).
      // On a Mac with Python, optionally rasterize PDFs page-by-page for higher accuracy.
      if (isPdf && canRunLocalOcr()) {
        try {
          const pageBuffers = await rasterizePdf(bytes);
          const results = [];
          for (const page of pageBuffers) {
            results.push(await geminiExtract(apiKey, page, "image/png"));
          }
          const extractions = results.flatMap((r) => r.extractions);
          const warnings = results.map((r) => r.warning).filter((w): w is string => Boolean(w));
          return NextResponse.json(
            payload(extractions, {
              engine: "gemini",
              warning: warnings[0],
              warnings,
              needs_review: extractions.some((e) => e.overall_confidence < 80) || warnings.length > 0,
            }),
          );
        } catch {
          // Fall through to direct PDF upload.
        }
      }

      const { extractions, warning } = await geminiExtract(apiKey, bytes, mime);
      return NextResponse.json(
        payload(extractions, {
          engine: "gemini",
          warning,
          needs_review: extractions.some((e) => e.overall_confidence < 80) || Boolean(warning),
        }),
      );
    }

    if (!canRunLocalOcr()) {
      return NextResponse.json(
        payload([emptyExtraction()], {
          engine: "none",
          warning:
            "Automatic OCR is not configured on this hosted site. Add GEMINI_API_KEY in Vercel → Project → Settings → Environment Variables, then redeploy. The original file was stored — fill the verification form manually for now.",
          needs_review: true,
        }),
      );
    }

    const local = await runLocalOcr(bytes, { filename: file.name, mime });
    if (!local.pages.length) {
      return NextResponse.json(
        payload([emptyExtraction()], {
          engine: "none",
          warning: "No pages were found in the upload. Fill the verification form manually — nothing was guessed.",
          needs_review: true,
        }),
      );
    }

    const extractions = local.pages.map((page) => parseLalaInvoice(page.text, page.lines));
    const low = extractions.filter((e) => e.overall_confidence < 80).length;
    const warning =
      local.pages.length > 1
        ? `Split into ${local.pages.length} invoices (one per PDF page) using local OCR. Verify before saving — nothing missing was guessed.`
        : low
          ? "Local OCR filled what it could read. Verify highlighted fields — nothing missing was guessed."
          : undefined;

    return NextResponse.json(
      payload(extractions, {
        engine: "rapidocr",
        warning,
        needs_review: Boolean(warning) || extractions.some((e) => e.overall_confidence < 80),
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR failed";
    return NextResponse.json(
      payload([emptyExtraction()], {
        engine: "none",
        warning: `OCR failed (${message}). The original file was stored. Fill the verification form manually — nothing was guessed.`,
        needs_review: true,
      }),
    );
  }
}
