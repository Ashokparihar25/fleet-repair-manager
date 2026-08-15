import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertGeminiBudget } from "@/lib/ocr/gemini-usage";
import { prepareGeminiPdfFile } from "@/lib/ocr/gemini";
import { pdfPageCount } from "@/lib/ocr/split-pdf";
import { isUsingSupabase } from "@/lib/supabase/config";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 300;

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
 * Upload PDF to Gemini Files API once, then OCR pages in small chunks using the returned uri.
 * Keeps the first browser request from also doing 12 paced page extracts (which caused Failed to fetch timeouts).
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

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 400 });
  }

  try {
    await assertGeminiBudget(1);
    const bytes = await loadBytesFromStorage(filePath);
    const fileName = body?.file_name || path.basename(filePath);
    const pageCount = await pdfPageCount(bytes);
    const prepared = await prepareGeminiPdfFile(apiKey, bytes, fileName);
    return NextResponse.json({
      page_count: pageCount,
      gemini_file_uri: prepared.uri,
      gemini_file_name: prepared.name,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not prepare Gemini OCR file" },
      { status: 500 },
    );
  }
}
