import { createClient } from "@supabase/supabase-js";

export type UploadedInvoiceFile = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
};

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (/request entity too large/i.test(text) || res.status === 413) {
    return "File is too large for this host’s upload limit. Use a smaller/compressed PDF, or ensure direct Storage upload is enabled.";
  }
  try {
    const json = JSON.parse(text) as { error?: string };
    if (json.error) return json.error;
  } catch {
    /* not JSON */
  }
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 180);
  return snippet || `Upload failed (HTTP ${res.status})`;
}

export async function parseApiJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (/request entity too large/i.test(text) || res.status === 413) {
    throw new Error(
      "File is too large for this host’s upload limit (Vercel ~4.5MB). Re-try after deploy with direct Storage upload, or upload a compressed PDF.",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 120);
    throw new Error(
      snippet
        ? `Server returned a non-JSON response: ${snippet}`
        : `Server returned a non-JSON response (HTTP ${res.status})`,
    );
  }
}

/** Upload invoice bytes without sending them through Vercel when Supabase is available. */
export async function uploadInvoiceFile(file: File): Promise<UploadedInvoiceFile> {
  const prepareRes = await fetch("/api/upload/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      file_size: file.size,
    }),
  });
  const prepare = await parseApiJson<{
    mode: "direct" | "proxy";
    id: string;
    file_name: string;
    file_path?: string;
    file_type: string;
    file_size: number | null;
    bucket?: string;
    token?: string;
    path?: string;
    error?: string;
  }>(prepareRes);
  if (!prepareRes.ok) throw new Error(prepare.error || "Could not prepare upload");

  if (prepare.mode === "direct" && prepare.token && prepare.bucket && prepare.path) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      throw new Error("Supabase public keys are missing — cannot upload directly to Storage.");
    }
    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.storage
      .from(prepare.bucket)
      .uploadToSignedUrl(prepare.path, prepare.token, file, {
        contentType: file.type || "application/octet-stream",
      });
    if (error) throw new Error(error.message || "Direct Storage upload failed");

    return {
      id: prepare.id,
      file_name: prepare.file_name,
      file_path: prepare.file_path || prepare.path,
      file_type: prepare.file_type,
      file_size: file.size,
    };
  }

  // Local / demo fallback: file goes through the Next.js route (fine off Vercel).
  const fd = new FormData();
  fd.set("file", file);
  const upRes = await fetch("/api/upload", { method: "POST", body: fd });
  if (!upRes.ok) throw new Error(await readErrorMessage(upRes));
  const up = await parseApiJson<UploadedInvoiceFile & { error?: string }>(upRes);
  if (!up.file_path) throw new Error(up.error || "Upload failed");
  return {
    id: up.id || prepare.id,
    file_name: up.file_name || file.name,
    file_path: up.file_path,
    file_type: up.file_type || file.type,
    file_size: up.file_size || file.size,
  };
}
