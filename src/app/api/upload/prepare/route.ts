import { NextResponse } from "next/server";
import { newId } from "@/lib/ids";
import { getSession } from "@/lib/auth";
import { isUsingSupabase } from "@/lib/supabase/config";
import { requireAdminSupabase } from "@/lib/supabase/admin";

/**
 * Prepare an upload without sending file bytes through Vercel.
 * On Supabase: returns a signed upload URL (browser → Storage direct).
 * Otherwise: client should fall back to POST /api/upload with FormData.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    file_name?: string;
    file_type?: string;
    file_size?: number;
  } | null;

  const fileName = body?.file_name?.trim();
  if (!fileName) {
    return NextResponse.json({ error: "file_name is required" }, { status: 400 });
  }

  const id = newId();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (!isUsingSupabase()) {
    return NextResponse.json({
      mode: "proxy" as const,
      id,
      file_name: fileName,
      file_type: body?.file_type || "application/octet-stream",
      file_size: body?.file_size ?? null,
    });
  }

  const storagePath = `${id}/${safeName}`;
  const admin = requireAdminSupabase();
  const { data, error } = await admin.storage.from("invoice-documents").createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Could not create signed upload URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    mode: "direct" as const,
    id,
    file_name: fileName,
    file_path: storagePath,
    file_type: body?.file_type || "application/octet-stream",
    file_size: body?.file_size ?? null,
    bucket: "invoice-documents",
    token: data.token,
    signed_url: data.signedUrl,
    path: data.path || storagePath,
  });
}
