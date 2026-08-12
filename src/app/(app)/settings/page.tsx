import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/data/queries";
import { hasServiceRole, isSupabaseConfigured, isUsingSupabase } from "@/lib/supabase/config";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetDemoButton } from "@/components/settings/reset-demo-button";

export default async function SettingsPage() {
  const session = await getSession();
  const store = await getStore();
  const configured = isSupabaseConfigured();
  const live = isUsingSupabase();

  return (
    <div>
      <PageHeader title="Settings" description="Data source and app status. Login is currently disabled." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Name" value={session?.name ?? "—"} />
            <Row label="Email" value={session?.email ?? "—"} />
            <Row label="Role" value={session?.role ?? "—"} />
            <Row
              label="Mode"
              value={
                process.env.NEXT_PUBLIC_AUTH_DISABLED !== "false"
                  ? session?.demo
                    ? "Open access · local store"
                    : "Open access · Supabase (no login)"
                  : session?.demo
                    ? "Demo (local store)"
                    : "Supabase Auth"
              }
            />
            <a href="/audit" className="block pt-2 text-primary hover:underline">
              Open audit log →
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Admin</strong> — full access, including delete and demo reset.</p>
            <p><strong className="text-foreground">Manager</strong> — create/edit invoices and vehicles.</p>
            <p><strong className="text-foreground">Staff</strong> — upload invoices and OCR verification.</p>
            <p><strong className="text-foreground">Viewer</strong> — read-only.</p>
            <p className="pt-2">Row Level Security policies are defined in <code>supabase/migrations/0001_init.sql</code>.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Data source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Supabase configured"
              value={configured ? "Yes" : "No — using local .data/store.json"}
            />
            <Row label="Live Postgres" value={live ? "Yes" : "No — demo / local store"} />
            <Row label="Service role" value={hasServiceRole() ? "Yes" : "Missing SUPABASE_SERVICE_ROLE_KEY"} />
            <Row label="Vehicles" value={String(store.vehicles.length)} />
            <Row label="Invoices" value={String(store.invoices.length)} />
            <Row label="Parts lines" value={String(store.invoice_parts.length)} />
            <Row label="Labor lines" value={String(store.invoice_labor.length)} />
            <p className="pt-2 text-muted-foreground">
              To use PostgreSQL + Auth + Storage, create a Supabase project, run <code>npm run setup:supabase</code>{" "}
              (or paste <code>supabase/migrations/</code> into the SQL editor), then set{" "}
              <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and{" "}
              <code>SUPABASE_SERVICE_ROLE_KEY</code>. Set <code>NEXT_PUBLIC_DEMO_MODE=false</code> and restart{" "}
              <code>npm run dev</code>.
            </p>
            {session?.role === "admin" && !live && <ResetDemoButton />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>OCR</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Set <code>GEMINI_API_KEY</code> to enable automatic extraction from scanned PDFs/images. Without a key,
            originals are still stored and the verification form is filled in manually. Source values are preserved
            separately from normalized values.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
