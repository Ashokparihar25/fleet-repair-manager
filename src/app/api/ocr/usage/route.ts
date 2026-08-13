import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGeminiUsage } from "@/lib/ocr/gemini-usage";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const usage = await getGeminiUsage();
    return NextResponse.json(usage);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load Gemini usage" },
      { status: 500 },
    );
  }
}
