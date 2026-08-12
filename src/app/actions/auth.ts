"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, demoUserByEmail } from "@/lib/auth";
import { isAuthDisabled } from "@/lib/auth-config";
import { isUsingSupabase } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

export async function demoLogin(formData: FormData) {
  if (isUsingSupabase()) {
    redirect("/login?error=supabase");
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = demoUserByEmail(email);
  if (!user || password !== "demo") {
    redirect("/login?error=1");
  }
  const store = await cookies();
  store.set(DEMO_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function supabaseLogin(formData: FormData) {
  if (!isUsingSupabase()) {
    redirect("/login?error=1");
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const supabase = await createServerSupabase();
  if (!supabase) redirect("/login?error=config");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=1");
  redirect("/");
}

export async function logout() {
  if (isAuthDisabled()) redirect("/");
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  if (isUsingSupabase()) {
    const supabase = await createServerSupabase();
    await supabase?.auth.signOut();
  }
  redirect("/login");
}
