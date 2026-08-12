import { execFile } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import type { OcrLine } from "@/lib/ocr/lala-parser";

const execFileAsync = promisify(execFile);

export type LocalOcrPage = {
  page: number;
  text: string;
  width?: number;
  height?: number;
  lines: OcrLine[];
};

export type LocalOcrResult = {
  pages: LocalOcrPage[];
  engine: "rapidocr" | "vision";
};

function scriptPath(name: string) {
  return path.join(process.cwd(), "scripts", name);
}

function inferExt(filename: string, mime: string): string {
  const fromName = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  if (fromName && fromName.length <= 8) return fromName;
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("tif")) return ".tiff";
  return ".bin";
}

export async function runLocalOcr(
  bytes: Buffer,
  opts: { filename?: string; mime?: string; zoom?: number } = {},
): Promise<LocalOcrResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "fleet-ocr-"));
  const ext = inferExt(opts.filename ?? "", opts.mime ?? "");
  const inputPath = path.join(dir, `input${ext || ".pdf"}`);
  try {
    await writeFile(inputPath, bytes);
    const args = [scriptPath("ocr-pages.py"), inputPath];
    if (opts.zoom) args.push("--zoom", String(opts.zoom));
    const { stdout } = await execFileAsync("python3", args, {
      maxBuffer: 64 * 1024 * 1024,
      timeout: 300_000,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    const parsed = JSON.parse(stdout) as {
      engine?: string;
      pages?: Array<{
        page?: number;
        text?: string;
        width?: number;
        height?: number;
        lines?: OcrLine[];
      }>;
    };
    const pages: LocalOcrPage[] = (parsed.pages ?? []).map((p, i) => ({
      page: p.page ?? i + 1,
      text: p.text ?? "",
      width: p.width,
      height: p.height,
      lines: Array.isArray(p.lines) ? p.lines : [],
    }));
    return { pages, engine: "rapidocr" };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function rasterizePdf(bytes: Buffer, zoom = 2): Promise<Buffer[]> {
  const dir = await mkdtemp(path.join(tmpdir(), "fleet-raster-"));
  const inputPath = path.join(dir, "input.pdf");
  try {
    await writeFile(inputPath, bytes);
    const { stdout } = await execFileAsync("python3", [scriptPath("rasterize-pdf.py"), inputPath, dir, String(zoom)], {
      maxBuffer: 16 * 1024 * 1024,
      timeout: 120_000,
    });
    const { readFile } = await import("fs/promises");
    const paths = stdout
      .trim()
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    return Promise.all(paths.map((p) => readFile(p)));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
