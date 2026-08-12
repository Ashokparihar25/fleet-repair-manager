import { cookies } from "next/headers";
import type { UserRole } from "@/types";
import { isUsingSupabase } from "@/lib/supabase/config";
import { isAuthDisabled } from "@/lib/auth-config";

export { isAuthDisabled } from "@/lib/auth-config";

export const DEMO_COOKIE = "fleet_demo_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  demo: boolean;
}

const DEMO_USERS: Record<string, SessionUser> = {
  "admin@fleet.local": {
    id: "00000000-0000-0000-0000-000000000001",
    email: "admin@fleet.local",
    name: "Admin",
    role: "admin",
    demo: true,
  },
  "manager@fleet.local": {
    id: "00000000-0000-0000-0000-000000000002",
    email: "manager@fleet.local",
    name: "Manager",
    role: "manager",
    demo: true,
  },
  "staff@fleet.local": {
    id: "00000000-0000-0000-0000-000000000003",
    email: "staff@fleet.local",
    name: "Staff",
    role: "staff",
    demo: true,
  },
  "viewer@fleet.local": {
    id: "00000000-0000-0000-0000-000000000004",
    email: "viewer@fleet.local",
    name: "Viewer",
    role: "viewer",
    demo: true,
  },
};

export function demoUserByEmail(email: string): SessionUser | null {
  return DEMO_USERS[email.toLowerCase()] ?? null;
}

const OPEN_ACCESS_USER: SessionUser = {
  id: "",
  email: "open-access@local",
  name: "Fleet Admin",
  role: "admin",
  demo: false,
};

export async function getSession(): Promise<SessionUser | null> {
  if (isAuthDisabled()) {
    return { ...OPEN_ACCESS_USER, demo: !isUsingSupabase() };
  }

  if (isUsingSupabase()) {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = await createServerSupabase();
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase.from("profiles").select("full_name, email, role").eq("id", user.id).maybeSingle();

    return {
      id: user.id,
      email: user.email ?? profile?.email ?? "",
      name: profile?.full_name || user.user_metadata?.full_name || user.email || "User",
      role: (profile?.role as UserRole) || "viewer",
      demo: false,
    };
  }

  const store = await cookies();
  const raw = store.get(DEMO_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function canWrite(role: UserRole) {
  return role === "admin" || role === "manager" || role === "staff";
}

export function canManage(role: UserRole) {
  return role === "admin" || role === "manager";
}

export function isAdmin(role: UserRole) {
  return role === "admin";
}
