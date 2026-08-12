import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/data/queries";
import { isUsingSupabase } from "@/lib/supabase/config";
import { requireAdminSupabase } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const store = await getStore();
  const doc = store.documents.find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isUsingSupabase()) {
    try {
      const admin = requireAdminSupabase();
      const { data, error } = await admin.storage.from("invoice-documents").download(doc.file_path);
      if (error || !data) {
        return NextResponse.json({ error: error?.message || "File not found in Storage." }, { status: 404 });
      }
      const buf = Buffer.from(await data.arrayBuffer());
      return new NextResponse(buf, {
        headers: {
          "Content-Type": doc.file_type || "application/octet-stream",
          "Content-Disposition": `inline; filename="${doc.file_name}"`,
        },
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not download file from Supabase Storage." },
        { status: 500 },
      );
    }
  }

  try {
    const full = path.join(process.cwd(), ".data", "uploads", doc.file_path);
    const buf = await readFile(full);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": doc.file_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${doc.file_name}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Original file is not on this server. Upload it again or connect Supabase Storage." },
      { status: 404 },
    );
  }
}
