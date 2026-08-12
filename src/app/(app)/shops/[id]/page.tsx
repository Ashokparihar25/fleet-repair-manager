import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryLabel } from "@/lib/categorize";
import { invoiceDate, invoicePrimaryCategory, invoiceSpend, monthlySpend, vehicleLabel } from "@/lib/analytics";
import { addMoney, divideMoney, formatMoney, formatNumber } from "@/lib/money";
import { getStore } from "@/lib/data/queries";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MonthlySpendChart } from "@/components/charts/dashboard-charts";

export default async function ShopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStore();
  const shop = store.repair_shops.find((s) => s.id === id);
  if (!shop) notFound();

  const invs = store.invoices
    .filter((i) => i.repair_shop_id === shop.id && i.payment_status !== "voided")
    .sort((a, b) => (invoiceDate(b) ?? "").localeCompare(invoiceDate(a) ?? ""));
  const total = addMoney(...invs.map(invoiceSpend));
  const parts = addMoney(...invs.map((i) => i.parts_total));
  const labor = addMoney(...invs.map((i) => i.labor_total));
  const avg = invs.length ? divideMoney(total, invs.length) : "0.00";
  const cats = new Map<string, number>();
  for (const inv of invs) {
    const c = invoicePrimaryCategory(store, inv.id);
    cats.set(c, (cats.get(c) ?? 0) + 1);
  }
  const mostCommon = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
  const mostExpensive = [...invs].sort((a, b) => Number(b.invoice_total ?? 0) - Number(a.invoice_total ?? 0))[0];
  const vehiclesServed = new Set(invs.map((i) => i.vehicle_id).filter(Boolean)).size;

  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/shops", label: "Shops" }, { label: shop.name }]}
        title={shop.name}
        description={[shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(", ")}
        actions={
          <Link href={`/shops/${shop.id}/edit`}>
            <button className="h-9 rounded-md border px-4 text-sm">Edit shop</button>
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total invoices" value={String(invs.length)} />
        <StatCard label="Total spending" value={formatMoney(total)} />
        <StatCard label="Average invoice" value={formatMoney(avg)} />
        <StatCard label="Vehicles serviced" value={String(vehiclesServed)} />
        <StatCard label="Total parts" value={formatMoney(parts)} />
        <StatCard label="Total labor" value={formatMoney(labor)} />
        <StatCard label="Most common repair" value={mostCommon ? categoryLabel(mostCommon[0]) : "—"} hint={mostCommon ? `${mostCommon[1]} invoices` : undefined} />
        <StatCard
          label="Most expensive repair"
          value={mostExpensive ? `#${mostExpensive.invoice_number}` : "—"}
          hint={mostExpensive ? formatMoney(mostExpensive.invoice_total) : undefined}
          href={mostExpensive ? `/invoices/${mostExpensive.id}` : undefined}
        />
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Shop details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div><div className="text-xs text-muted-foreground">Phone</div>{shop.phone ?? "—"}</div>
          <div><div className="text-xs text-muted-foreground">Fax</div>{shop.fax ?? "—"}</div>
          <div><div className="text-xs text-muted-foreground">Registration</div>{shop.registration_number ?? "—"}</div>
          <div><div className="text-xs text-muted-foreground">Notes</div>{shop.notes ?? "—"}</div>
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Monthly spending</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlySpendChart data={monthlySpend(invs)} />
        </CardContent>
      </Card>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Mileage</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invs.map((inv) => {
              const v = store.vehicles.find((x) => x.id === inv.vehicle_id);
              return (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(invoiceDate(inv))}</TableCell>
                  <TableCell>{vehicleLabel(v)}</TableCell>
                  <TableCell>{formatNumber(inv.odometer_in)}</TableCell>
                  <TableCell>{categoryLabel(invoicePrimaryCategory(store, inv.id))}</TableCell>
                  <TableCell>{formatMoney(inv.invoice_total)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
