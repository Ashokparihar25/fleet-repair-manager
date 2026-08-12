import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { emptyExtraction } from "@/lib/ocr/parse";
import { parseLalaInvoice } from "@/lib/ocr/lala-parser";
import { geminiExtractInline, geminiExtractPdfByPage } from "@/lib/ocr/gemini";
import { canRunLocalOcr, rasterizePdf, runLocalOcr } from "@/lib/ocr/local";
import { isEmptyExtraction } from "@/lib/ocr/quality";
import { isUsingSupabase } from "@/lib/supabase/config";
import { requireAdminSupabase } from "@/lib/supabase/admin";
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
  const needs = list.some((e) => e.overall_confidence < 80 || isEmptyExtraction(e)) || Boolean(extra.warning);
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

async function loadBytesFromStorage(filePath: string): Promise<Buffer> {
  if (isUsingSupabase()) {
    const admin = requireAdminSupabase();
    const { data, error } = await admin.storage.from("invoice-documents").download(filePath);
    if (error || !data) {
      throw new Error(error?.message || "Could not download file from Storage for OCR.");
    }
    return Buffer.from(await data.arrayBuffer());
  }
  const full = path.join(process.cwd(), ".data", "uploads", filePath);
  return readFile(full);
}

async function runOcrOnBytes(input: {
  bytes: Buffer;
  fileName: string;
  mime: string;
}): Promise<NextResponse> {
  const { bytes, fileName, mime } = input;
  const isPdf = mime.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const resolvedMime = isPdf ? "application/pdf" : mime || "image/png";
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  try {
    if (apiKey) {
      if (isPdf && canRunLocalOcr()) {
        try {
          const pageBuffers = await rasterizePdf(bytes);
          const results = [];
          for (const page of pageBuffers) {
            results.push(await geminiExtractInline(apiKey, page, "image/png", { singlePage: true }));
          }
          const extractions = results.flatMap((r) => r.extractions);
          const warnings = results.map((r) => r.warning).filter((w): w is string => Boolean(w));
          return NextResponse.json(
            payload(extractions, {
              engine: "gemini",
              warning: warnings[0],
              warnings,
              needs_review: extractions.some((e) => e.overall_confidence < 80 || isEmptyExtraction(e)) || warnings.length > 0,
            }),
          );
        } catch {
          // Fall through to Files API / pdf-lib path.
        }
      }

      if (isPdf) {
        const { extractions, warning, warnings } = await geminiExtractPdfByPage(apiKey, bytes);
        return NextResponse.json(
          payload(extractions, {
            engine: "gemini",
            warning,
            warnings,
            needs_review: extractions.some((e) => e.overall_confidence < 80 || isEmptyExtraction(e)) || Boolean(warning),
          }),
        );
      }

      const { extractions, warning } = await geminiExtractInline(apiKey, bytes, resolvedMime, { singlePage: true });
      return NextResponse.json(
        payload(extractions, {
          engine: "gemini",
          warning,
          needs_review: extractions.some((e) => e.overall_confidence < 80 || isEmptyExtraction(e)) || Boolean(warning),
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

    const local = await runLocalOcr(bytes, { filename: fileName, mime: resolvedMime });
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

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as {
      file_path?: string;
      file_name?: string;
      file_type?: string;
    } | null;
    const filePath = body?.file_path?.trim();
    if (!filePath) {
      return NextResponse.json({ error: "file_path is required" }, { status: 400 });
    }
    try {
      const bytes = await loadBytesFromStorage(filePath);
      const fileName = body?.file_name || path.basename(filePath);
      const mime =
        body?.file_type ||
        (fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
      return runOcrOnBytes({ bytes, fileName, mime });
    } catch (err) {
      const message = err instanceof Error ? err.message : "OCR failed";
      return NextResponse.json(
        payload([emptyExtraction()], {
          engine: "none",
          warning: `OCR failed (${message}).`,
          needs_review: true,
        }),
      );
    }
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  return runOcrOnBytes({ bytes, fileName: file.name, mime });
}
