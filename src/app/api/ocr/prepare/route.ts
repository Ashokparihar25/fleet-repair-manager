import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGeminiUsage, geminiPagesPerRequest } from "@/lib/ocr/gemini-usage";
import { pdfPageCount } from "@/lib/ocr/split-pdf";
import { isUsingSupabase } from "@/lib/supabase/config";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 120;

async function loadBytesFromStorage(filePath: string): Promise<Buffer> {
  if (isUsingSupabase()) {
    const admin = requireAdminSupabase();
    const { data, error } = await admin.storage.from("invoice-documents").download(filePath);
    if (error || !data) {
      throw new Error(error?.message || "Could not download file from Storage.");
    }
    return Buffer.from(await data.arrayBuffer());
  }
  return readFile(path.join(process.cwd(), ".data", "uploads", filePath));
}

/**
 * Count pages so the browser knows how many OCR batches to request.
 * Costs no Gemini quota — extraction happens in /api/ocr.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    file_path?: string;
    file_name?: string;
    file_type?: string;
  } | null;

  const filePath = body?.file_path?.trim();
  if (!filePath) return NextResponse.json({ error: "file_path is required" }, { status: 400 });

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 400 });
  }

  const fileName = body?.file_name || path.basename(filePath);
  const isPdf = (body?.file_type || "").includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  const pagesPerRequest = geminiPagesPerRequest();

  try {
    const pageCount = isPdf ? await pdfPageCount(await loadBytesFromStorage(filePath)) : 1;
    const usage = await getGeminiUsage();
    const requestsNeeded = Math.ceil(pageCount / pagesPerRequest);
    const quotaShort = usage.remaining != null && usage.remaining < requestsNeeded;

    return NextResponse.json({
      page_count: pageCount,
      pages_per_request: pagesPerRequest,
      requests_needed: requestsNeeded,
      requests_remaining: usage.remaining,
      warning: quotaShort
        ? `This file needs ~${requestsNeeded} Gemini requests but only ${usage.remaining} remain today. Pages beyond the quota will need a re-run after midnight Pacific.`
        : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read the uploaded PDF" },
      { status: 500 },
    );
  }
}
