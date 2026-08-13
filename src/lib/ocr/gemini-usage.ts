import { requireAdminSupabase } from "@/lib/supabase/admin";
import { isUsingSupabase } from "@/lib/supabase/config";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type GeminiUsageSnapshot = {
  day: string; // YYYY-MM-DD in America/Los_Angeles (Google RPD reset timezone)
  used: number;
  remaining: number | null;
  limit_rpd: number | null;
  limit_rpm: number;
  model: string;
  rate_limit_hits: number;
  configured: boolean;
  note: string;
};

type DayRecord = { count: number; rate_limit_hits: number };
type UsageFile = { days: Record<string, DayRecord> };

const USAGE_STORAGE_PATH = "system/gemini-usage.json";
const LOCAL_USAGE_PATH = path.join(process.cwd(), ".data", "gemini-usage.json");

/** Google RPD quotas reset at midnight Pacific Time. */
export function pacificDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function geminiModelName() {
  return process.env.OCR_GEMINI_MODEL || "gemini-2.5-flash";
}

/**
 * Configurable limits. Defaults match common Free-tier Flash values.
 * Exact project limits live in Google AI Studio — set these env vars to match yours.
 */
export function geminiConfiguredLimits() {
  const rpdRaw = process.env.OCR_GEMINI_RPD_LIMIT?.trim();
  const rpmRaw = process.env.OCR_GEMINI_RPM_LIMIT?.trim();
  const limit_rpd = rpdRaw === "" || rpdRaw == null ? 250 : Math.max(1, Number(rpdRaw) || 250);
  const limit_rpm = rpmRaw === "" || rpmRaw == null ? 10 : Math.max(1, Number(rpmRaw) || 10);
  // Paid / unlimited: set OCR_GEMINI_RPD_LIMIT=0
  return {
    limit_rpd: Number(rpdRaw) === 0 ? null : limit_rpd,
    limit_rpm,
  };
}

async function readUsageFile(): Promise<UsageFile> {
  if (isUsingSupabase()) {
    try {
      const admin = requireAdminSupabase();
      const { data, error } = await admin.storage.from("invoice-documents").download(USAGE_STORAGE_PATH);
      if (error || !data) return { days: {} };
      const text = await data.text();
      const parsed = JSON.parse(text) as UsageFile;
      return parsed?.days ? parsed : { days: {} };
    } catch {
      return { days: {} };
    }
  }
  try {
    const text = await readFile(LOCAL_USAGE_PATH, "utf8");
    const parsed = JSON.parse(text) as UsageFile;
    return parsed?.days ? parsed : { days: {} };
  } catch {
    return { days: {} };
  }
}

async function writeUsageFile(file: UsageFile): Promise<void> {
  const body = Buffer.from(JSON.stringify(file, null, 2), "utf8");
  if (isUsingSupabase()) {
    const admin = requireAdminSupabase();
    const { error } = await admin.storage.from("invoice-documents").upload(USAGE_STORAGE_PATH, body, {
      contentType: "application/json",
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return;
  }
  await mkdir(path.dirname(LOCAL_USAGE_PATH), { recursive: true });
  await writeFile(LOCAL_USAGE_PATH, body);
}

export async function getGeminiUsage(): Promise<GeminiUsageSnapshot> {
  const day = pacificDayKey();
  const { limit_rpd, limit_rpm } = geminiConfiguredLimits();
  const configured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const file = await readUsageFile();
  const rec = file.days[day] ?? { count: 0, rate_limit_hits: 0 };
  const remaining = limit_rpd == null ? null : Math.max(0, limit_rpd - rec.count);

  return {
    day,
    used: rec.count,
    remaining,
    limit_rpd,
    limit_rpm,
    model: geminiModelName(),
    rate_limit_hits: rec.rate_limit_hits,
    configured,
    note:
      limit_rpd == null
        ? "Daily request cap disabled (OCR_GEMINI_RPD_LIMIT=0). Still paced by RPM."
        : `Tracked app requests today (Pacific). Google free-tier Flash is often ~${limit_rpm} RPM / ~${limit_rpd} RPD — confirm in AI Studio. Each invoice page ≈ 1+ API call.`,
  };
}

export async function recordGeminiRequest(opts: { rateLimited?: boolean } = {}): Promise<GeminiUsageSnapshot> {
  const day = pacificDayKey();
  const file = await readUsageFile();
  const prev = file.days[day] ?? { count: 0, rate_limit_hits: 0 };
  file.days[day] = {
    count: prev.count + 1,
    rate_limit_hits: prev.rate_limit_hits + (opts.rateLimited ? 1 : 0),
  };
  // Keep last ~14 days only.
  const keys = Object.keys(file.days).sort();
  while (keys.length > 14) {
    const old = keys.shift();
    if (old) delete file.days[old];
  }
  await writeUsageFile(file);
  return getGeminiUsage();
}

export async function assertGeminiBudget(needed = 1): Promise<GeminiUsageSnapshot> {
  const snap = await getGeminiUsage();
  if (!snap.configured) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  if (snap.limit_rpd != null && snap.remaining != null && snap.remaining < needed) {
    throw new Error(
      `Gemini daily limit reached for ${snap.day} Pacific (${snap.used}/${snap.limit_rpd} requests used). Resets at midnight Pacific, or raise OCR_GEMINI_RPD_LIMIT / enable billing in Google AI Studio.`,
    );
  }
  return snap;
}

/** Minimum delay between page calls to stay under RPM. */
export function geminiPaceDelayMs() {
  const { limit_rpm } = geminiConfiguredLimits();
  // Leave headroom vs the hard RPM cap.
  return Math.ceil((60_000 / Math.max(1, limit_rpm)) * 1.1);
}
