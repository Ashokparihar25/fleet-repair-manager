import { redirect } from "next/navigation";
import { getSession, isAuthDisabled } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session && !isAuthDisabled()) redirect("/login");
  if (!session) redirect("/");
  return <AppShell user={session}>{children}</AppShell>;
}
