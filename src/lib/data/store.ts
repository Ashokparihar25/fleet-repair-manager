import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createSeedStore } from "@/lib/data/seed";
import { flagMileageAnomalies } from "@/lib/mileage";
import { isUsingSupabase } from "@/lib/supabase/config";
import { normalizeStore } from "@/lib/data/store-normalize";
import type { FleetStore } from "@/types";

export { normalizeStore } from "@/lib/data/store-normalize";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

let memory: FleetStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function loadStore(): Promise<FleetStore> {
  if (isUsingSupabase()) {
    const { loadSupabaseStore } = await import("@/lib/data/supabase-store");
    return loadSupabaseStore();
  }
  if (memory) {
    const missingClients = !Array.isArray(memory.clients) || memory.clients.length === 0;
    memory = normalizeStore(memory);
    memory.mileage_history = flagMileageAnomalies(memory.mileage_history);
    if (missingClients) await persistLocalStore(memory);
    return memory;
  }
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    memory = normalizeStore(JSON.parse(raw) as FleetStore);
    memory.mileage_history = flagMileageAnomalies(memory.mileage_history);
    await persistLocalStore(memory);
    return memory;
  } catch {
    memory = createSeedStore();
    memory.mileage_history = flagMileageAnomalies(memory.mileage_history);
    await persistLocalStore(memory);
    return memory;
  }
}

async function persistLocalStore(next: FleetStore): Promise<void> {
  memory = next;
  writeQueue = writeQueue.then(async () => {
    await ensureDir();
    await writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
  });
  await writeQueue;
}

export async function persistStore(next: FleetStore, prev?: FleetStore): Promise<void> {
  if (isUsingSupabase()) {
    const { persistSupabaseStore } = await import("@/lib/data/supabase-store");
    await persistSupabaseStore(next, prev);
    return;
  }
  await persistLocalStore(next);
}

export async function mutateStore(
  mutator: (store: FleetStore) => FleetStore | void,
): Promise<FleetStore> {
  const current = structuredClone(await loadStore());
  const prev = structuredClone(current);
  const result = mutator(current) ?? current;
  result.mileage_history = flagMileageAnomalies(result.mileage_history);
  await persistStore(result, prev);
  return result;
}

export async function resetStore(): Promise<FleetStore> {
  if (isUsingSupabase()) {
    const { resetSupabaseStore } = await import("@/lib/data/supabase-store");
    return resetSupabaseStore();
  }
  memory = createSeedStore();
  memory.mileage_history = flagMileageAnomalies(memory.mileage_history);
  await persistLocalStore(memory);
  return memory;
}
