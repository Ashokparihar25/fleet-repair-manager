# Fleet Repair Manager

Professional fleet auto-repair and invoice management for a rental-car business. Built around real **LALA AUTO REPAIR LLC** invoice structure: separate parts and labor, VIN-first vehicle matching, original document retention, and discrepancy detection.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Recharts
- Supabase (PostgreSQL, Auth, Storage) — production
- Local JSON store — works immediately with seeded LALA invoices

## Run locally

```bash
cp .env.example .env.local
# Edit .env.local with your Supabase keys (never commit this file)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Login is **disabled by default** (`NEXT_PUBLIC_AUTH_DISABLED=true`) so the app opens without a sign-in screen. Set `NEXT_PUBLIC_AUTH_DISABLED=false` when you want Auth later.

Demo credentials (only when auth is enabled and demo mode is on):

| Email | Password | Role |
| --- | --- | --- |
| admin@fleet.local | demo | Admin |
| manager@fleet.local | demo | Manager |
| staff@fleet.local | demo | Staff |
| viewer@fleet.local | demo | Viewer |

Seeded data includes 12 LALA invoices (1797, 1813, 1814, 1812, 1792, 1789, 1791, 1782, 1788, 1796, 1803, 1781) exactly as printed. Missing handwritten fleet IDs were **not invented**.

## Design principles

- **VIN** is the primary vehicle matching key (17 characters, uppercase, no spaces).
- **Fleet ID** (`vehicles.vehicle_id`, e.g. A010) is an auxiliary mapping, never the primary identity.
- **Parts** and **labor** are separate tables. Labor-only and part-only lines are valid.
- **Invoice total** from the document is stored as-is. A **calculated total** (parts + labor + tax) is stored separately. Mismatches show **Invoice total discrepancy** and are never silently corrected.
- Mileage is never silently corrected. Later lower mileage is flagged as **MILEAGE ANOMALY**.
- Possible duplicate invoices are flagged, never deleted.
- Original PDF/image is stored independently of OCR edits.

## OCR import

1. Repair Invoices → **Upload Invoice** (multi-file supported)
2. Original document is stored
3. OCR extracts shop, VIN, dates, mileage, parts, labor, totals, payment
4. VIN match → existing vehicle, or prompt to create/select
5. Verification screen (low confidence fields highlighted)
6. Confirm → save

Set `GEMINI_API_KEY` in `.env.local` for automatic extraction. Without a key, originals are still stored and the verification form is completed manually.

## Connect Supabase

The app runs in **demo mode** (local `.data/store.json`) until Supabase is configured.

### Automatic (recommended)

1. Create a [personal access token](https://supabase.com/dashboard/account/tokens).
2. Add it to `.env.local`:

```
SUPABASE_ACCESS_TOKEN=sbp_...
ADMIN_EMAIL=you@yourcompany.com
ADMIN_PASSWORD=choose-a-strong-password
```

3. Run:

```bash
npm run setup:supabase
```

That creates (or reuses) a `fleet-repair-manager` project, writes URL + keys into `.env.local`, applies migrations, creates the admin user, and seeds LALA invoices if the database is empty.

4. Restart `npm run dev` and sign in at [http://localhost:3000/login](http://localhost:3000/login).

### Manual

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Project Settings → API: copy URL, anon key, and service role key into `.env.local`.
3. Set `NEXT_PUBLIC_DEMO_MODE=false`.
4. SQL Editor: run in order:
   - `supabase/migrations/0001_init.sql` — schema, indexes, RLS, storage bucket `invoice-documents`
   - `supabase/migrations/0002_seed_categories.sql`
   - `supabase/migrations/0003_seed_lala_invoices.sql`
   - `supabase/migrations/0004_clients.sql`
   - `supabase/migrations/0005_fleet_clients_rls.sql`
5. `npm run setup:supabase` (creates the admin user).
6. Restart `npm run dev`.

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_DEMO_MODE=false
GEMINI_API_KEY=...
```

Roles (RLS): **Admin** full access · **Manager** create/edit · **Staff** upload/verify · **Viewer** read-only.

## Project layout

```
app/                 routes, server actions, API (OCR, upload, export)
components/          UI, charts, invoice/vehicle forms
lib/                 money (Decimal), VIN, categorize, alerts, analytics, OCR, data store
supabase/migrations/ PostgreSQL schema + LALA seed
types/               domain types
```

## Questions this system answers

- How much have we spent repairing A010?
- How much did LALA charge this month / this year?
- Which vehicles had brake / steering / alternator work?
- Highest maintenance cost / cost per mile?
- Repeated repairs (e.g. A010 tie rod)?
- Every invoice for VIN `1FA6P0H74G5132219`
- Unpaid invoices, mileage anomalies, total discrepancies
- All July 2026 invoices
- Every repair on A016 (mileage 159,000 → 159,700)
