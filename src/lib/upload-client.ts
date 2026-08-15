import { createClient } from "@supabase/supabase-js";

export type UploadedInvoiceFile = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
};

export function humanizeFetchError(err: unknown, fallback = "Request failed"): string {
  const msg = err instanceof Error ? err.message : String(err || fallback);
  if (/failed to fetch|networkerror|load failed|fetch aborted|aborted/i.test(msg)) {
    return "Connection dropped during OCR (host timeout or network). The app will retry smaller page batches — if it keeps failing, wait a minute and re-upload, or split the PDF into fewer pages.";
  }
  return msg || fallback;
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (/request entity too large/i.test(text) || res.status === 413) {
    return "File is too large for this host’s upload limit. Use a smaller/compressed PDF, or ensure direct Storage upload is enabled.";
  }
  try {
    const json = JSON.parse(text) as { error?: string; warning?: string };
    if (json.error) return json.error;
    if (json.warning) return json.warning;
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

/** fetch + JSON parse with retries for transient network / host drops. */
export async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: { retries?: number; label?: string } = {},
): Promise<{ res: Response; data: T }> {
  const retries = opts.retries ?? 3;
  const label = opts.label || "Request";
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      const data = await parseApiJson<T>(res);
      return { res, data };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        /failed to fetch|networkerror|load failed|aborted|timeout|502|503|504|non-JSON response/i.test(msg) ||
        (err instanceof TypeError && /fetch/i.test(msg));
      if (!retryable || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
  }

  throw new Error(humanizeFetchError(lastErr, `${label} failed`));
}

/** Upload invoice bytes without sending them through Vercel when Supabase is available. */
export async function uploadInvoiceFile(file: File): Promise<UploadedInvoiceFile> {
  try {
    const { res: prepareRes, data: prepare } = await fetchJsonWithRetry<{
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
    }>(
      "/api/upload/prepare",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
        }),
      },
      { label: "Upload prepare", retries: 2 },
    );
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
  } catch (err) {
    throw new Error(humanizeFetchError(err, "Upload failed"));
  }
}
