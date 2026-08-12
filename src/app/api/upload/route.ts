import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { newId } from "@/lib/ids";
import { getSession } from "@/lib/auth";
import { isUsingSupabase } from "@/lib/supabase/config";
import { requireAdminSupabase } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const id = newId();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const rel = `${id}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (isUsingSupabase()) {
    const admin = requireAdminSupabase();
    const storagePath = `${id}/${safeName}`;
    const { error } = await admin.storage.from("invoice-documents").upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      id,
      file_name: file.name,
      file_path: storagePath,
      file_type: file.type,
      file_size: file.size,
    });
  }

  const dir = path.join(process.cwd(), ".data", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, rel), bytes);

  return NextResponse.json({
    id,
    file_name: file.name,
    file_path: rel,
    file_type: file.type,
    file_size: file.size,
  });
}
