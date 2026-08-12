import { analyzeVehicleCost, invoiceDate, invoiceSpend, spendByCategory, vehicleLabel } from "@/lib/analytics";
import { categoryLabel } from "@/lib/categorize";
import { getStore } from "@/lib/data/queries";
import { addMoney, formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportsFilter } from "@/components/reports/reports-filter";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const vehicleId = typeof sp.vehicleId === "string" ? sp.vehicleId : "";
  const dateFrom = typeof sp.dateFrom === "string" ? sp.dateFrom : "";
  const dateTo = typeof sp.dateTo === "string" ? sp.dateTo : "";
  const store = await getStore();

  let invs = store.invoices.filter((i) => i.payment_status !== "voided");
  if (vehicleId) invs = invs.filter((i) => i.vehicle_id === vehicleId);
  if (dateFrom) invs = invs.filter((i) => (invoiceDate(i) ?? "") >= dateFrom);
  if (dateTo) invs = invs.filter((i) => (invoiceDate(i) ?? "") <= dateTo);

  const scoped = {
    ...store,
    invoices: invs,
    invoice_parts: store.invoice_parts.filter((p) => invs.some((i) => i.id === p.invoice_id)),
    invoice_labor: store.invoice_labor.filter((l) => invs.some((i) => i.id === l.invoice_id)),
  };
  const cats = spendByCategory(scoped);
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ vehicleId, dateFrom, dateTo }).filter(([, v]) => v),
    ) as Record<string, string>,
  ).toString();

  const vehicleCosts = store.vehicles
    .map((v) => analyzeVehicleCost(v, invs, store.invoice_parts, store.invoice_labor))
    .filter((c) => c.numberOfRepairs > 0)
    .sort((a, b) => Number(b.repairCostPerMile ?? 0) - Number(a.repairCostPerMile ?? 0));

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Answer fleet cost questions instantly. Export CSV or Excel."
        actions={
          <>
            <a href={`/api/reports/export?format=csv&${qs}`}>
              <Button variant="outline">Export CSV</Button>
            </a>
            <a href={`/api/reports/export?format=xlsx&${qs}`}>
              <Button variant="outline">Export Excel</Button>
            </a>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["vehicle", "Vehicle repair"],
          ["monthly", "Monthly expense"],
          ["shop", "Shop expense"],
          ["parts", "Parts"],
          ["labor", "Labor"],
          ["tax", "Tax"],
          ["cost", "Vehicle cost"],
          ["category", "Category"],
          ["mileage", "Mileage"],
          ["warranty", "Warranty"],
        ].map(([type, label]) => (
          <a
            key={type}
            href={`#report-${type}`}
            className="rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {label}
          </a>
        ))}
      </div>
      <ReportsFilter vehicles={store.vehicles} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="Invoices" value={String(invs.length)} />
        <Summary label="Total parts" value={formatMoney(addMoney(...invs.map((i) => i.parts_total)))} />
        <Summary label="Total labor" value={formatMoney(addMoney(...invs.map((i) => i.labor_total)))} />
        <Summary label="Total tax" value={formatMoney(addMoney(...invs.map((i) => i.tax)))} />
        <Summary label="Total repairs" value={formatMoney(addMoney(...invs.map(invoiceSpend)))} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {cats.map((c) => (
              <div key={c.category} className="flex justify-between border-b py-1">
                <span>{c.name}</span>
                <span className="font-medium">{formatMoney(c.total.toFixed(2))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Highest repair cost per mile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {vehicleCosts.slice(0, 10).map((c) => {
              const v = store.vehicles.find((x) => x.id === c.vehicleId);
              return (
                <div key={c.vehicleId} className="flex justify-between border-b py-1">
                  <a href={`/vehicles/${c.vehicleId}`} className="text-primary hover:underline">
                    {vehicleLabel(v)}
                  </a>
                  <span>{formatMoney(c.repairCostPerMile)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card id="report-category">
          <CardHeader>
            <CardTitle>Repair category report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {cats.map((c) => (
              <div key={c.category} className="flex justify-between border-b py-1">
                <span>{c.name}</span>
                <span>
                  {formatMoney(c.parts.toFixed(2))} parts · {formatMoney(c.labor.toFixed(2))} labor
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card id="report-cost">
          <CardHeader>
            <CardTitle>Vehicle cost report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {store.vehicles
              .map((v) => analyzeVehicleCost(v, invs, store.invoice_parts, store.invoice_labor))
              .filter((c) => c.numberOfRepairs > 0)
              .sort((a, b) => Number(b.totalRepairCost) - Number(a.totalRepairCost))
              .map((c) => {
                const v = store.vehicles.find((x) => x.id === c.vehicleId);
                return (
                  <div key={c.vehicleId} className="grid grid-cols-4 gap-2 border-b py-1">
                    <a href={`/vehicles/${c.vehicleId}`} className="text-primary hover:underline">
                      {vehicleLabel(v)}
                    </a>
                    <span>{c.numberOfRepairs} RO</span>
                    <span>{formatMoney(c.totalRepairCost)}</span>
                    <span>{formatMoney(c.repairCostPerMile)} / mi</span>
                  </div>
                );
              })}
          </CardContent>
        </Card>
        <Card id="report-parts">
          <CardHeader>
            <CardTitle>Parts report</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 space-y-1 overflow-auto text-sm">
            {scoped.invoice_parts.map((p) => (
              <div key={p.id} className="flex justify-between gap-2 border-b py-1">
                <span className="truncate">{p.part_description}</span>
                <span className="shrink-0">{formatMoney(p.extended_price)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card id="report-labor">
          <CardHeader>
            <CardTitle>Labor report</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 space-y-1 overflow-auto text-sm">
            {scoped.invoice_labor.map((l) => (
              <div key={l.id} className="flex justify-between gap-2 border-b py-1">
                <span className="truncate">{l.labor_description}</span>
                <span className="shrink-0">{formatMoney(l.extended_amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card id="report-tax">
          <CardHeader>
            <CardTitle>Tax report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invs.map((inv) => (
              <div key={inv.id} className="flex justify-between border-b py-1">
                <a href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                  #{inv.invoice_number}
                </a>
                <span>{formatMoney(inv.tax)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold">
              <span>Total tax</span>
              <span>{formatMoney(addMoney(...invs.map((i) => i.tax)))}</span>
            </div>
          </CardContent>
        </Card>
        <Card id="report-mileage">
          <CardHeader>
            <CardTitle>Mileage report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {store.mileage_history
              .filter((m) => !vehicleId || m.vehicle_id === vehicleId)
              .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
              .map((m) => {
                const v = store.vehicles.find((x) => x.id === m.vehicle_id);
                return (
                  <div key={m.id} className="flex justify-between border-b py-1">
                    <span>
                      {vehicleLabel(v)} · {formatDate(m.recorded_at)}
                    </span>
                    <span>
                      {m.mileage.toLocaleString()} mi{m.anomaly ? " ⚠" : ""}
                    </span>
                  </div>
                );
              })}
          </CardContent>
        </Card>
        <Card id="report-warranty">
          <CardHeader>
            <CardTitle>Warranty report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {store.warranty_records.length === 0 ? (
              <p className="text-muted-foreground">No warranty records yet. Add them from a vehicle profile.</p>
            ) : (
              store.warranty_records.map((w) => {
                const v = store.vehicles.find((x) => x.id === w.vehicle_id);
                return (
                  <div key={w.id} className="flex justify-between border-b py-1">
                    <a href={`/vehicles/${w.vehicle_id}`} className="text-primary hover:underline">
                      {vehicleLabel(v)} · {w.component}
                    </a>
                    <span>{w.warranty_provider ?? "—"}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card id="report-shop">
          <CardHeader>
            <CardTitle>Shop expense report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {store.repair_shops.map((shop) => {
              const shopInvs = invs.filter((i) => i.repair_shop_id === shop.id);
              return (
                <div key={shop.id} className="flex justify-between border-b py-1">
                  <Link href={`/shops/${shop.id}`} className="text-primary hover:underline">
                    {shop.name}
                  </Link>
                  <span>
                    {shopInvs.length} inv · {formatMoney(addMoney(...shopInvs.map(invoiceSpend)))}
                  </span>
                </div>
              );
            })}
            <Link href="/shops/compare" className="block pt-2 text-primary hover:underline">
              Compare shops →
            </Link>
          </CardContent>
        </Card>
        <Card id="report-monthly" className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Monthly repair expense</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(
              invs.reduce<Record<string, string>>((acc, inv) => {
                const d = invoiceDate(inv);
                if (!d) return acc;
                const m = d.slice(0, 7);
                acc[m] = addMoney(acc[m], invoiceSpend(inv));
                return acc;
              }, {}),
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, total]) => (
                <div key={month} className="flex justify-between border-b py-1">
                  <span>{month}</span>
                  <span className="font-medium">{formatMoney(total)}</span>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card id="report-vehicle" className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Invoice register / vehicle repair report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {invs
              .sort((a, b) => (invoiceDate(b) ?? "").localeCompare(invoiceDate(a) ?? ""))
              .map((inv) => {
                const v = store.vehicles.find((x) => x.id === inv.vehicle_id);
                return (
                  <div key={inv.id} className="grid grid-cols-6 gap-2 border-b py-1">
                    <a className="text-primary hover:underline" href={`/invoices/${inv.id}`}>
                      #{inv.invoice_number}
                    </a>
                    <span>{formatDate(invoiceDate(inv))}</span>
                    <span>{v?.vehicle_id ?? vehicleLabel(v)}</span>
                    <span>{categoryLabel(spendByCategory({ ...store, invoices: [inv], invoice_parts: store.invoice_parts.filter((p) => p.invoice_id === inv.id), invoice_labor: store.invoice_labor.filter((l) => l.invoice_id === inv.id) })[0]?.category)}</span>
                    <span>{formatMoney(inv.invoice_total)}</span>
                    <span>{inv.payment_status}</span>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
