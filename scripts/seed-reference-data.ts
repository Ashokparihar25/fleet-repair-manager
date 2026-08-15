import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { createSeedStore } from "../src/lib/data/seed";
import { normalizeStore } from "../src/lib/data/store-normalize";

async function main() {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const seed = normalizeStore(createSeedStore());
  for (const [table, rows] of [
    ["fleet_clients", seed.clients],
    ["repair_shops", seed.repair_shops],
    ["vehicles", seed.vehicles],
  ] as const) {
    const { error } = await admin.from(table).upsert(rows as never[]);
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`upserted ${table}: ${rows.length}`);
  }

  for (const t of ["fleet_clients", "repair_shops", "vehicles", "invoices", "repair_categories"]) {
    const { count, error } = await admin.from(t).select("id", { count: "exact", head: true });
    if (error) throw error;
    console.log(t, count);
  }

  const { data: a010 } = await admin
    .from("vehicles")
    .select("vehicle_id,vin,make,model")
    .eq("vin", "1FA6P0H74G5132219")
    .maybeSingle();
  console.log("A010", a010);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
