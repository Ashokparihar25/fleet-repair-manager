export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isDemoMode() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") return false;
  if (!isSupabaseConfigured()) return true;
  return process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
}

/** True when the app should read/write Postgres + Auth instead of local JSON. */
export function isUsingSupabase() {
  return isSupabaseConfigured() && !isDemoMode();
}

export function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
