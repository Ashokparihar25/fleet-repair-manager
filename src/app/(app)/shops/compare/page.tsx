import Link from "next/link";
import { addMoney, divideMoney, formatMoney } from "@/lib/money";
import { invoicePrimaryCategory, invoiceSpend, monthlySpend } from "@/lib/analytics";
import { categoryLabel } from "@/lib/categorize";
import { getStore } from "@/lib/data/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlySpendChart } from "@/components/charts/dashboard-charts";

export default async function ShopComparePage() {
  const store = await getStore();
  const shops = store.repair_shops.map((shop) => {
    const invs = store.invoices.filter((i) => i.repair_shop_id === shop.id && i.payment_status !== "voided");
    const cats = new Map<string, number>();
    for (const inv of invs) {
      const c = invoicePrimaryCategory(store, inv.id);
      cats.set(c, (cats.get(c) ?? 0) + 1);
    }
    const mostCommon = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
    const total = addMoney(...invs.map(invoiceSpend));
    return {
      shop,
      invs,
      total,
      avg: invs.length ? divideMoney(total, invs.length) : "0.00",
      parts: addMoney(...invs.map((i) => i.parts_total)),
      labor: addMoney(...invs.map((i) => i.labor_total)),
      vehicles: new Set(invs.map((i) => i.vehicle_id).filter(Boolean)).size,
      mostCommon: mostCommon ? categoryLabel(mostCommon[0]) : "—",
      monthly: monthlySpend(invs),
    };
  });

  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/shops", label: "Shops" }, { label: "Compare" }]}
        title="Shop comparison"
        description="Compare spend, labor vs parts, and common repairs. Add another shop anytime — LALA is the current baseline."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shops.map((row) => (
          <Card key={row.shop.id}>
            <CardHeader>
              <CardTitle>
                <Link href={`/shops/${row.shop.id}`} className="hover:underline">
                  {row.shop.name}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Invoices" value={String(row.invs.length)} />
              <Row label="Total spend" value={formatMoney(row.total)} />
              <Row label="Average invoice" value={formatMoney(row.avg)} />
              <Row label="Parts" value={formatMoney(row.parts)} />
              <Row label="Labor" value={formatMoney(row.labor)} />
              <Row label="Vehicles serviced" value={String(row.vehicles)} />
              <Row label="Most common repair" value={row.mostCommon} />
              <div className="pt-2">
                <MonthlySpendChart data={row.monthly} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
