import { redirect } from "next/navigation";
import { isAuthDisabled } from "@/lib/auth-config";
import { Wrench } from "lucide-react";
import { demoLogin, supabaseLogin } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured, isUsingSupabase } from "@/lib/supabase/config";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isAuthDisabled()) redirect("/");

  const sp = await searchParams;
  const error = sp.error;
  const supabase = isUsingSupabase();
  const configured = isSupabaseConfigured();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#1e3a8a_0%,_#0b1220_45%,_#020617_100%)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wrench className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Fleet Repair Manager</CardTitle>
          <CardDescription>
            {supabase
              ? "Sign in with your Supabase account to manage invoices, vehicles, parts, and labor."
              : "Invoice, vehicle, parts, and labor tracking for your rental fleet. Demo mode is active until Supabase Auth is connected."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {error === "config"
                ? "Supabase is not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
                : error === "supabase"
                  ? "Demo login is disabled. Use your Supabase email and password."
                  : supabase
                    ? "Invalid email or password."
                    : "Invalid demo credentials. Use admin@fleet.local / demo."}
            </p>
          )}
          <form action={supabase ? supabaseLogin : demoLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={supabase ? "" : "admin@fleet.local"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                defaultValue={supabase ? "" : "demo"}
                required
              />
            </div>
            <Button className="w-full" type="submit">
              Sign in
            </Button>
          </form>
          {supabase ? (
            <div className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              Connected to Supabase Auth. Ask an admin if you need an account. First user can be created with{" "}
              <code>npm run setup:supabase</code>.
            </div>
          ) : (
            <div className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">Demo roles</div>
              <ul className="mt-1 space-y-0.5">
                <li>admin@fleet.local / demo — full access</li>
                <li>manager@fleet.local / demo — create/edit</li>
                <li>staff@fleet.local / demo — upload & verify</li>
                <li>viewer@fleet.local / demo — read only</li>
              </ul>
              {configured && (
                <p className="mt-2">
                  Supabase keys are present, but <code>NEXT_PUBLIC_DEMO_MODE</code> is not <code>false</code>, so the
                  local demo store is still in use.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
