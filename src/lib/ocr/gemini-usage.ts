import { requireAdminSupabase } from "@/lib/supabase/admin";
import { isUsingSupabase } from "@/lib/supabase/config";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type GeminiModelUsage = {
  model: string;
  used: number;
  remaining: number | null;
  limit_rpd: number | null;
  exhausted: boolean;
};

export type GeminiUsageSnapshot = {
  day: string; // YYYY-MM-DD in America/Los_Angeles (Google RPD reset timezone)
  used: number;
  remaining: number | null;
  limit_rpd: number | null;
  limit_rpm: number;
  model: string;
  models: GeminiModelUsage[];
  pages_per_request: number;
  pages_remaining: number | null;
  rate_limit_hits: number;
  configured: boolean;
  note: string;
};

type ModelRecord = {
  count: number;
  rate_limit_hits: number;
  /** Set when Google returned a per-day quota 429 for this model today. */
  daily_exhausted?: boolean;
  /** Daily limit Google reported in a 429 (free tier is often 20). */
  observed_limit?: number | null;
};
type UsageFile = { days: Record<string, Record<string, ModelRecord>> };

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

/**
 * Daily quotas are per project PER MODEL, so falling back to another model buys a
 * fresh allowance once the first one is exhausted.
 */
export function geminiModelChain(): string[] {
  const raw = process.env.OCR_GEMINI_MODELS?.trim() || process.env.OCR_GEMINI_MODEL?.trim();
  const chain = (raw || "gemini-3.7-flash,gemini-3.5-flash,gemini-2.5-flash")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return chain.length ? chain : ["gemini-3.7-flash"];
}

export function geminiModelName() {
  return geminiModelChain()[0];
}

/** Pages sent to Gemini in a single request (one request covers a whole batch of invoice pages). */
export function geminiPagesPerRequest() {
  const raw = Number(process.env.OCR_PAGE_BATCH || 6);
  return Math.max(1, Math.min(15, Number.isFinite(raw) && raw > 0 ? raw : 6));
}

/**
 * Free tier for Flash models is currently 20 requests/day/model and ~10 requests/minute.
 * Override with env vars when billing is enabled (OCR_GEMINI_RPD_LIMIT=0 disables the cap).
 */
export function geminiConfiguredLimits() {
  const rpdRaw = process.env.OCR_GEMINI_RPD_LIMIT?.trim();
  const rpmRaw = process.env.OCR_GEMINI_RPM_LIMIT?.trim();
  const limit_rpd = rpdRaw === "" || rpdRaw == null ? 20 : Math.max(1, Number(rpdRaw) || 20);
  const limit_rpm = rpmRaw === "" || rpmRaw == null ? 10 : Math.max(1, Number(rpmRaw) || 10);
  return {
    limit_rpd: Number(rpdRaw) === 0 ? null : limit_rpd,
    limit_rpm,
  };
}

function emptyRecord(): ModelRecord {
  return { count: 0, rate_limit_hits: 0 };
}

/** Old files stored one record per day; migrate them onto the primary model. */
function normalizeDay(value: unknown): Record<string, ModelRecord> {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  if (typeof obj.count === "number") {
    return {
      [geminiModelName()]: {
        count: obj.count,
        rate_limit_hits: typeof obj.rate_limit_hits === "number" ? obj.rate_limit_hits : 0,
      },
    };
  }
  const out: Record<string, ModelRecord> = {};
  for (const [model, rec] of Object.entries(obj)) {
    if (rec && typeof rec === "object" && typeof (rec as ModelRecord).count === "number") {
      out[model] = rec as ModelRecord;
    }
  }
  return out;
}

async function readUsageFile(): Promise<UsageFile> {
  const parse = (text: string): UsageFile => {
    const parsed = JSON.parse(text) as { days?: Record<string, unknown> };
    const days: Record<string, Record<string, ModelRecord>> = {};
    for (const [day, rec] of Object.entries(parsed?.days ?? {})) days[day] = normalizeDay(rec);
    return { days };
  };

  if (isUsingSupabase()) {
    try {
      const admin = requireAdminSupabase();
      const { data, error } = await admin.storage.from("invoice-documents").download(USAGE_STORAGE_PATH);
      if (error || !data) return { days: {} };
      return parse(await data.text());
    } catch {
      return { days: {} };
    }
  }
  try {
    return parse(await readFile(LOCAL_USAGE_PATH, "utf8"));
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

function snapshotFrom(file: UsageFile): GeminiUsageSnapshot {
  const day = pacificDayKey();
  const { limit_rpd, limit_rpm } = geminiConfiguredLimits();
  const chain = geminiModelChain();
  const today = file.days[day] ?? {};
  const pagesPerRequest = geminiPagesPerRequest();

  const models: GeminiModelUsage[] = chain.map((model) => {
    const rec = today[model] ?? emptyRecord();
    const modelLimit = rec.observed_limit ?? limit_rpd;
    const remaining =
      modelLimit == null ? null : rec.daily_exhausted ? 0 : Math.max(0, modelLimit - rec.count);
    return {
      model,
      used: rec.count,
      remaining,
      limit_rpd: modelLimit,
      exhausted: Boolean(rec.daily_exhausted) || remaining === 0,
    };
  });

  const used = models.reduce((sum, m) => sum + m.used, 0);
  const remaining = models.some((m) => m.remaining == null)
    ? null
    : models.reduce((sum, m) => sum + (m.remaining ?? 0), 0);
  const rateLimitHits = chain.reduce((sum, m) => sum + (today[m]?.rate_limit_hits ?? 0), 0);
  const totalLimit = models.some((m) => m.limit_rpd == null)
    ? null
    : models.reduce((sum, m) => sum + (m.limit_rpd ?? 0), 0);

  return {
    day,
    used,
    remaining,
    limit_rpd: totalLimit,
    limit_rpm,
    model: chain[0],
    models,
    pages_per_request: pagesPerRequest,
    pages_remaining: remaining == null ? null : remaining * pagesPerRequest,
    rate_limit_hits: rateLimitHits,
    configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    note:
      remaining == null
        ? "Daily cap disabled (OCR_GEMINI_RPD_LIMIT=0). Requests are still paced against the per-minute limit."
        : `One request covers up to ${pagesPerRequest} invoice pages, and each model has its own free daily quota. Quotas reset at midnight Pacific.`,
  };
}

export async function getGeminiUsage(): Promise<GeminiUsageSnapshot> {
  return snapshotFrom(await readUsageFile());
}

export async function recordGeminiRequest(opts: {
  model: string;
  rateLimited?: boolean;
  dailyExhausted?: boolean;
  observedLimit?: number | null;
}): Promise<void> {
  const day = pacificDayKey();
  const file = await readUsageFile();
  const today = file.days[day] ?? {};
  const prev = today[opts.model] ?? emptyRecord();

  today[opts.model] = {
    count: prev.count + 1,
    rate_limit_hits: prev.rate_limit_hits + (opts.rateLimited ? 1 : 0),
    daily_exhausted: prev.daily_exhausted || opts.dailyExhausted || false,
    observed_limit: opts.observedLimit ?? prev.observed_limit ?? null,
  };
  file.days[day] = today;

  const keys = Object.keys(file.days).sort();
  while (keys.length > 14) {
    const old = keys.shift();
    if (old) delete file.days[old];
  }

  try {
    await writeUsageFile(file);
  } catch {
    /* usage tracking must never block OCR */
  }
}

/** Models in the fallback chain that still have daily quota left today. */
export async function availableGeminiModels(): Promise<string[]> {
  const snap = await getGeminiUsage();
  const usable = snap.models.filter((m) => !m.exhausted).map((m) => m.model);
  // Never block entirely on local bookkeeping — Google is the source of truth.
  return usable.length ? usable : [];
}

export async function assertGeminiBudget(neededRequests = 1): Promise<GeminiUsageSnapshot> {
  const snap = await getGeminiUsage();
  if (!snap.configured) throw new Error("GEMINI_API_KEY is not configured.");
  if (snap.remaining != null && snap.remaining < neededRequests) {
    throw new Error(
      `Gemini free daily quota is used up for ${snap.day} Pacific (${snap.used}/${snap.limit_rpd} requests across ${snap.models.length} models). It resets at midnight Pacific. To keep going now, enable billing in Google AI Studio or add more models to OCR_GEMINI_MODELS.`,
    );
  }
  return snap;
}

/** Minimum delay between requests to stay under the per-minute limit. */
export function geminiPaceDelayMs() {
  const { limit_rpm } = geminiConfiguredLimits();
  return Math.ceil((60_000 / Math.max(1, limit_rpm)) * 1.1);
}
