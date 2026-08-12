/**
 * Connect Fleet Repair Manager to a Supabase project.
 *
 * Usage:
 *   npx tsx scripts/setup-supabase.ts
 *
 * Optional env (in .env.local or the shell):
 *   SUPABASE_ACCESS_TOKEN   personal access token — can create the project + run SQL
 *   NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 *   DATABASE_URL            postgres URI — apply migrations with psql
 *   ADMIN_EMAIL / ADMIN_PASSWORD
 *   SUPABASE_ORG_ID         if you have more than one org
 *   SUPABASE_DB_PASSWORD    used when creating a new project
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const ENV_PATH = resolve(ROOT, ".env.local");
const MIGRATIONS_DIR = resolve(ROOT, "supabase/migrations");
const API = "https://api.supabase.com/v1";

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(ENV_PATH);

function log(msg: string) {
  console.log(msg);
}

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function randomPassword(length = 24) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function projectRefFromUrl(url?: string | null) {
  if (!url) return null;
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m?.[1] ?? null;
}

function upsertEnv(updates: Record<string, string>) {
  let text = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  if (text && !text.endsWith("\n")) text += "\n";
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(text)) text = text.replace(re, line);
    else text += `${line}\n`;
    process.env[key] = value;
  }
  writeFileSync(ENV_PATH, text, "utf8");
  log(`Updated ${ENV_PATH}`);
}

async function api<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T; text: string }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: token,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null as T;
  try {
    data = text ? (JSON.parse(text) as T) : (null as T);
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, data, text };
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => resolve(MIGRATIONS_DIR, f));
}

function applyWithPsql(databaseUrl: string) {
  const psql = spawnSync("psql", ["--version"], { encoding: "utf8" });
  if (psql.status !== 0) return false;
  for (const file of migrationFiles()) {
    log(`  psql ← ${file}`);
    const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", file], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      fail(`psql failed on ${file}`);
    }
  }
  return true;
}

async function applyWithManagementApi(token: string, ref: string) {
  for (const file of migrationFiles()) {
    const query = readFileSync(file, "utf8");
    log(`  API SQL ← ${file}`);
    const res = await api(token, "POST", `/projects/${ref}/database/query`, { query });
    if (!res.ok) {
      fail(`Could not run ${file} via Management API (${res.status}): ${res.text}`);
    }
  }
}

async function createProject(token: string) {
  const orgsRes = await api<{ id: string; name: string }[]>(token, "GET", "/organizations");
  if (!orgsRes.ok || !Array.isArray(orgsRes.data) || orgsRes.data.length === 0) {
    fail(
      `Could not list Supabase organizations (${orgsRes.status}). Create a personal access token at https://supabase.com/dashboard/account/tokens and set SUPABASE_ACCESS_TOKEN.`,
    );
  }
  const orgs = orgsRes.data;
  const org =
    orgs.find((o) => o.id === process.env.SUPABASE_ORG_ID) ||
    orgs.find((o) => /fleet|cardeed|lala/i.test(o.name)) ||
    orgs[0];
  log(`Using organization: ${org.name} (${org.id})`);

  const listRes = await api<{ id: string; name: string; status: string; region: string }[]>(
    token,
    "GET",
    "/projects",
  );
  if (listRes.ok && Array.isArray(listRes.data)) {
    const existing =
      listRes.data.find((p) => p.name === "fleet-repair-manager") ||
      listRes.data.find((p) => /fleet/i.test(p.name));
    if (existing) {
      log(`Found existing project: ${existing.name} (${existing.id})`);
      return existing;
    }
  }

  const dbPass = process.env.SUPABASE_DB_PASSWORD || randomPassword(28);
  process.env.SUPABASE_DB_PASSWORD = dbPass;
  log("Creating Supabase project “fleet-repair-manager”…");
  const created = await api<{ id: string; name: string; status: string; region: string }>(
    token,
    "POST",
    "/projects",
    {
      name: "fleet-repair-manager",
      organization_id: org.id,
      db_pass: dbPass,
      region: process.env.SUPABASE_REGION || "us-east-1",
      plan: "free",
    },
  );
  if (!created.ok || !created.data?.id) {
    fail(`Could not create project (${created.status}): ${created.text}`);
  }
  log(`Created project ${created.data.id}. Waiting until it is healthy…`);

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const check = await api<{ status: string }>(token, "GET", `/projects/${created.data.id}`);
    const status = check.data?.status ?? "?";
    log(`  status: ${status}`);
    if (status === "ACTIVE_HEALTHY") return { ...created.data, status };
  }
  fail("Project did not become healthy in time. Check the Supabase dashboard and re-run this script.");
}

async function fetchApiKeys(token: string, ref: string) {
  const res = await api<{ name: string; api_key: string }[]>(token, "GET", `/projects/${ref}/api-keys`);
  if (!res.ok || !Array.isArray(res.data)) {
    fail(`Could not fetch API keys (${res.status}): ${res.text}`);
  }
  const anon = res.data.find((k) => k.name === "anon")?.api_key;
  const service = res.data.find((k) => k.name === "service_role")?.api_key;
  if (!anon || !service) fail("API keys response did not include anon + service_role.");
  return { anon, service };
}

async function ensureAdmin(url: string, serviceKey: string) {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = (process.env.ADMIN_EMAIL || "admin@fleet.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || randomPassword(18);
  const generated = !process.env.ADMIN_PASSWORD;

  const list = await admin.auth.admin.listUsers({ perPage: 200 });
  if (list.error) fail(`Could not list auth users: ${list.error.message}`);
  const existing = list.data.users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    const upd = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: "Fleet Admin", role: "admin" },
    });
    if (upd.error) fail(`Could not update admin user: ${upd.error.message}`);
    await admin.from("profiles").update({ role: "admin", full_name: "Fleet Admin", email }).eq("id", existing.id);
    log(`Updated admin user ${email}`);
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Fleet Admin", role: "admin" },
    });
    if (created.error) fail(`Could not create admin user: ${created.error.message}`);
    if (created.data.user) {
      await admin.from("profiles").update({ role: "admin", full_name: "Fleet Admin", email }).eq("id", created.data.user.id);
    }
    log(`Created admin user ${email}`);
  }

  if (generated) {
    upsertEnv({ ADMIN_EMAIL: email, ADMIN_PASSWORD: password });
    log(`\nAdmin login:\n  email:    ${email}\n  password: ${password}\n(saved to .env.local — change it after first login)\n`);
  } else {
    log(`Admin login: ${email} (password from ADMIN_PASSWORD)`);
  }
}

async function seedIfEmpty(url: string, serviceKey: string) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
  process.env.NEXT_PUBLIC_DEMO_MODE = "false";
  const { loadSupabaseStore, persistSupabaseStore } = await import("../src/lib/data/supabase-store");
  const { createSeedStore } = await import("../src/lib/data/seed");
  const { normalizeStore } = await import("../src/lib/data/store-normalize");
  const { flagMileageAnomalies } = await import("../src/lib/mileage");

  const current = await loadSupabaseStore();
  if (current.vehicles.length > 0) {
    log(`Database already has ${current.vehicles.length} vehicle(s). Skipping JS seed.`);
    return;
  }
  log("No vehicles found — seeding LALA demo data from the app store…");
  const seed = normalizeStore(createSeedStore());
  seed.mileage_history = flagMileageAnomalies(seed.mileage_history);
  if (current.repair_categories.length > 0) seed.repair_categories = current.repair_categories;
  if (current.clients.length > 0) seed.clients = current.clients;
  if (current.repair_shops.some((s) => s.id === seed.repair_shops[0]?.id)) {
    seed.repair_shops = current.repair_shops;
  }
  await persistSupabaseStore(seed, current);
  log("Seed complete.");
}

async function main() {
  log("Fleet Repair Manager → Supabase setup\n");

  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  let service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const token = process.env.SUPABASE_ACCESS_TOKEN || "";
  let ref = projectRefFromUrl(url);

  if ((!url || !anon || !service) && token) {
    const project = await createProject(token);
    ref = project.id;
    url = `https://${ref}.supabase.co`;
    const keys = await fetchApiKeys(token, ref);
    anon = keys.anon;
    service = keys.service;
    upsertEnv({
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
      SUPABASE_SERVICE_ROLE_KEY: service,
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "Fleet Repair Manager",
    });
    if (process.env.SUPABASE_DB_PASSWORD) {
      upsertEnv({
        DATABASE_URL: `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@db.${ref}.supabase.co:5432/postgres`,
      });
    }
  }

  if (!url || !anon || !service) {
    fail(
      [
        "Missing Supabase credentials.",
        "",
        "Option A — paste keys from an existing project into .env.local:",
        "  NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co",
        "  NEXT_PUBLIC_SUPABASE_ANON_KEY=...",
        "  SUPABASE_SERVICE_ROLE_KEY=...",
        "  NEXT_PUBLIC_DEMO_MODE=false",
        "",
        "Option B — let this script create the project:",
        "  1. Open https://supabase.com/dashboard/account/tokens",
        "  2. Create a token and add SUPABASE_ACCESS_TOKEN=... to .env.local",
        "  3. Re-run: npm run setup:supabase",
      ].join("\n"),
    );
  }

  ref = ref || projectRefFromUrl(url);
  log(`Project URL: ${url}`);

  let migrated = false;
  if (process.env.DATABASE_URL) {
    log("Applying migrations with psql…");
    migrated = applyWithPsql(process.env.DATABASE_URL);
    if (!migrated) log("psql not installed; will try Management API or ask you to paste SQL.");
  }
  if (!migrated && token && ref) {
    log("Applying migrations via Supabase Management API…");
    try {
      await applyWithManagementApi(token, ref);
      migrated = true;
    } catch (e) {
      log(`Management API SQL failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  const probe = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const ping = await probe.from("repair_categories").select("id").limit(1);
  if (ping.error) {
    const files = migrationFiles()
      .map((f) => `  • ${f.replace(`${ROOT}/`, "")}`)
      .join("\n");
    fail(
      [
        `Database schema is not ready (${ping.error.message}).`,
        migrated ? "Migrations were sent but the tables are still missing." : "Migrations were not applied automatically.",
        "",
        "Open Supabase → SQL Editor and run these files in order:",
        files,
        "",
        "Then re-run: npm run setup:supabase",
      ].join("\n"),
    );
  }
  log("Schema looks good.");

  await ensureAdmin(url, service);
  try {
    await seedIfEmpty(url, service);
  } catch (e) {
    log(`Seed skipped/failed: ${e instanceof Error ? e.message : e}`);
    log("You can still use the SQL seed in supabase/migrations/0002 + 0003 + 0004.");
  }

  upsertEnv({ NEXT_PUBLIC_DEMO_MODE: "false" });

  log(
    [
      "",
      "✓ Supabase is connected.",
      "Restart the app (stop npm run dev, then start it again) so it picks up .env.local.",
      "Then sign in at http://localhost:3000/login",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
