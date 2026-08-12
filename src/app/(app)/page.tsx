import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { buildAlerts } from "@/lib/alerts";
import {
  buildDashboardStats,
  mileageVsCost,
  monthlySpend,
  partsVsLabor,
  spendByCategory,
  spendByVehicle,
} from "@/lib/analytics";
import { getStore } from "@/lib/data/queries";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CategoryCountChart,
  CategorySpendChart,
  MileageCostScatter,
  MonthlySpendChart,
  PartsLaborPie,
  VehicleSpendChart,
} from "@/components/charts/dashboard-charts";

export default async function DashboardPage() {
  const store = await getStore();
  const stats = buildDashboardStats(store);
  const alerts = buildAlerts(store);
  const monthly = monthlySpend(store.invoices.filter((i) => i.payment_status !== "voided"));
  const byVehicle = spendByVehicle(store);
  const byCategory = spendByCategory(store);
  const pl = partsVsLabor(store);
  const scatter = mileageVsCost(store);

  return (
    <div>
      <PageHeader
        title="Fleet maintenance dashboard"
        description="Repair spend, shop performance, and invoice integrity across the rental fleet."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total vehicles" value={String(stats.totalVehicles)} hint="VIN-matched fleet records" href="/vehicles" />
        <StatCard label="Repair invoices" value={String(stats.repairInvoices)} href="/invoices" />
        <StatCard label="Total repair spend" value={formatMoney(stats.totalRepairSpend)} />
        <StatCard label="This month" value={formatMoney(stats.thisMonth)} />
        <StatCard label="This year" value={formatMoney(stats.thisYear)} />
        <StatCard label="Average repair cost" value={formatMoney(stats.averageRepairCost)} />
        <StatCard
          label="Most expensive vehicle"
          value={stats.mostExpensiveVehicle?.fleetId ?? stats.mostExpensiveVehicle?.label ?? "—"}
          hint={stats.mostExpensiveVehicle ? formatMoney(stats.mostExpensiveVehicle.total) : undefined}
          href={stats.mostExpensiveVehicle ? `/vehicles/${stats.mostExpensiveVehicle.id}` : undefined}
        />
        <StatCard
          label="Most common repair"
          value={stats.mostCommonRepair?.name ?? "—"}
          hint={stats.mostCommonRepair ? `${stats.mostCommonRepair.count} categorized lines` : undefined}
          href="/categories"
        />
      </div>

      <div className="mt-4">
        <StatCard
          label="Top repair shop"
          value={stats.topRepairShop?.name ?? "—"}
          hint={stats.topRepairShop ? formatMoney(stats.topRepairShop.total) : undefined}
          href={stats.topRepairShop ? `/shops/${stats.topRepairShop.id}` : "/shops"}
        />
      </div>

      {alerts.length > 0 && (
        <Card className="mt-6 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Alerts
              <Badge variant="warning">{alerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.slice(0, 12).map((a) => (
              <Link
                key={a.id}
                href={a.href ?? "#"}
                className="flex items-start justify-between gap-3 rounded-lg border bg-amber-50/60 px-3 py-2 hover:bg-amber-50"
              >
                <div>
                  <div className="text-sm font-medium">⚠ {a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.message}</div>
                </div>
                <Badge variant={a.severity === "critical" ? "destructive" : a.severity === "info" ? "info" : "warning"}>
                  {a.severity}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Repair spending by month</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlySpendChart data={monthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Repair spending by vehicle</CardTitle>
          </CardHeader>
          <CardContent>
            <VehicleSpendChart data={byVehicle} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Repair spending by category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategorySpendChart data={byCategory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Parts vs labor</CardTitle>
          </CardHeader>
          <CardContent>
            <PartsLaborPie data={pl} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Number of repairs by category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryCountChart data={byCategory.map((c) => ({ name: c.name, count: c.count }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mileage vs repair cost</CardTitle>
          </CardHeader>
          <CardContent>
            <MileageCostScatter data={scatter} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
