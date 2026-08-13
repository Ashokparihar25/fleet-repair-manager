import { assertGeminiBudget } from "@/lib/ocr/gemini-usage";
import { emptyExtraction } from "@/lib/ocr/parse";
import { parseLalaInvoice } from "@/lib/ocr/lala-parser";
import { geminiExtractInline, geminiExtractPdfByPage } from "@/lib/ocr/gemini";
import { canRunLocalOcr, rasterizePdf, runLocalOcr } from "@/lib/ocr/local";
import { isEmptyExtraction } from "@/lib/ocr/quality";
import { pdfPageCount } from "@/lib/ocr/split-pdf";
import { isUsingSupabase } from "@/lib/supabase/config";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import type { OcrExtractionResult } from "@/types";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

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
  processed_from?: number;
  processed_to?: number;
  next_page?: number | null;
  gemini_file_uri?: string;
  gemini_file_name?: string;
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
    page_count: extra.page_count ?? list.length,
    processed_from: extra.processed_from,
    processed_to: extra.processed_to,
    next_page: extra.next_page ?? null,
    gemini_file_uri: extra.gemini_file_uri,
    gemini_file_name: extra.gemini_file_name,
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
  pageFrom?: number;
  pageTo?: number;
  geminiFileUri?: string;
  geminiFileName?: string;
}): Promise<NextResponse> {
  const { bytes, fileName, mime, pageFrom, pageTo, geminiFileUri, geminiFileName } = input;
  const isPdf = mime.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const resolvedMime = isPdf ? "application/pdf" : mime || "image/png";
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  try {
    if (apiKey) {
      const pages = isPdf ? await pdfPageCount(bytes).catch(() => 1) : 1;
      const chunkSize = Math.max(1, Math.min(40, Number(process.env.OCR_PAGE_CHUNK || 12)));
      const from = Math.max(1, pageFrom ?? 1);
      const to = Math.min(pages, pageTo ?? from + chunkSize - 1);
      const needed = isPdf ? to - from + 1 : 1;
      try {
        await assertGeminiBudget(needed);
      } catch (budgetErr) {
        return NextResponse.json(
          payload([emptyExtraction()], {
            engine: "none",
            warning: budgetErr instanceof Error ? budgetErr.message : "Gemini daily limit reached.",
            needs_review: true,
            page_count: pages,
            processed_from: from,
            processed_to: from - 1,
            next_page: from,
          }),
        );
      }

      if (isPdf && canRunLocalOcr() && !pageFrom) {
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
              page_count: extractions.length,
              processed_from: 1,
              processed_to: extractions.length,
              next_page: null,
            }),
          );
        } catch {
          // Fall through to Files API / pdf-lib path.
        }
      }

      if (isPdf) {
        const result = await geminiExtractPdfByPage(apiKey, bytes, {
          pageFrom: from,
          pageTo: to,
          geminiFileUri,
          geminiFileName,
        });
        return NextResponse.json(
          payload(result.extractions, {
            engine: "gemini",
            warning: result.warning,
            warnings: result.warnings,
            needs_review: result.extractions.some((e) => e.overall_confidence < 80 || isEmptyExtraction(e)) || Boolean(result.warning),
            page_count: result.page_count,
            processed_from: result.processed_from,
            processed_to: result.processed_to,
            next_page: result.next_page,
            gemini_file_uri: result.gemini_file_uri,
            gemini_file_name: result.gemini_file_name,
          }),
        );
      }

      const { extractions, warning } = await geminiExtractInline(apiKey, bytes, resolvedMime, { singlePage: true });
      return NextResponse.json(
        payload(extractions, {
          engine: "gemini",
          warning,
          needs_review: extractions.some((e) => e.overall_confidence < 80 || isEmptyExtraction(e)) || Boolean(warning),
          page_count: 1,
          processed_from: 1,
          processed_to: 1,
          next_page: null,
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
      page_from?: number;
      page_to?: number;
      gemini_file_uri?: string;
      gemini_file_name?: string;
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
      return runOcrOnBytes({
        bytes,
        fileName,
        mime,
        pageFrom: body?.page_from,
        pageTo: body?.page_to,
        geminiFileUri: body?.gemini_file_uri,
        geminiFileName: body?.gemini_file_name,
      });
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
