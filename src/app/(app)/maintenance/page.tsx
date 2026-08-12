import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { detectRepeatedRepairs } from "@/lib/repeats";
import { analyzeVehicleCost, vehicleLabel } from "@/lib/analytics";
import { categoryLabel } from "@/lib/categorize";
import { getStore } from "@/lib/data/queries";
import { maintenanceStatusLabel, resolveMaintenanceStatus } from "@/lib/maintenance";
import { formatMoney, formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function MaintenancePage() {
  const store = await getStore();
  const repeats = detectRepeatedRepairs(store.invoices, store.invoice_parts, store.invoice_labor);
  const rows = store.vehicles
    .map((v) => ({ v, cost: analyzeVehicleCost(v, store.invoices, store.invoice_parts, store.invoice_labor) }))
    .filter((x) => x.cost.numberOfRepairs > 0)
    .sort((a, b) => Number(b.cost.totalRepairCost) - Number(a.cost.totalRepairCost));

  const schedules = [...store.maintenance_records].sort((a, b) => {
    const sa = resolveMaintenanceStatus(a, store.vehicles.find((v) => v.id === a.vehicle_id));
    const sb = resolveMaintenanceStatus(b, store.vehicles.find((v) => v.id === b.vehicle_id));
    const order = { overdue: 0, due: 1, scheduled: 2, completed: 3 };
    return order[sa] - order[sb];
  });

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Schedules, repeated repairs, and cost concentration across the fleet."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scheduled maintenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MaintenanceForm vehicles={store.vehicles} compact />
          {schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scheduled items yet. Add oil changes, brake inspections, or other preventive work by date or mileage.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Due mileage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((rec) => {
                  const v = store.vehicles.find((x) => x.id === rec.vehicle_id);
                  const status = resolveMaintenanceStatus(rec, v);
                  return (
                    <TableRow key={rec.id}>
                      <TableCell>
                        <Link href={`/vehicles/${rec.vehicle_id}`} className="text-primary hover:underline">
                          {vehicleLabel(v)}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{rec.title}</TableCell>
                      <TableCell>{categoryLabel(rec.category)}</TableCell>
                      <TableCell>{formatDate(rec.due_date)}</TableCell>
                      <TableCell>{formatNumber(rec.due_mileage)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === "completed"
                              ? "success"
                              : status === "overdue"
                                ? "destructive"
                                : status === "due"
                                  ? "warning"
                                  : "secondary"
                          }
                        >
                          {maintenanceStatusLabel(status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <MaintenanceForm vehicles={store.vehicles} record={rec} compact />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {repeats.map((r) => {
        const v = store.vehicles.find((x) => x.id === r.vehicleId);
        return (
          <Alert key={`${r.vehicleId}-${r.component}`} variant="warning" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              Repeated repair — {v?.vehicle_id ?? vehicleLabel(v)} / {r.component}
            </AlertTitle>
            <AlertDescription>
              Invoices {r.invoices.map((i) => `#${i.number}`).join(", ")}
              {r.daysBetween != null ? ` · ${r.daysBetween} days apart` : ""}.{" "}
              <Link href={`/vehicles/${r.vehicleId}`} className="underline">
                Open vehicle
              </Link>
            </AlertDescription>
          </Alert>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Repair cost concentration</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Repairs</TableHead>
                <TableHead>Total cost</TableHead>
                <TableHead>Avg cost</TableHead>
                <TableHead>$ / mile</TableHead>
                <TableHead>Last repair</TableHead>
                <TableHead>Last mileage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ v, cost }) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Link href={`/vehicles/${v.id}`} className="font-medium text-primary hover:underline">
                      {vehicleLabel(v)}
                    </Link>
                  </TableCell>
                  <TableCell>{cost.numberOfRepairs}</TableCell>
                  <TableCell>{formatMoney(cost.totalRepairCost)}</TableCell>
                  <TableCell>{formatMoney(cost.averageRepairCost)}</TableCell>
                  <TableCell>{formatMoney(cost.repairCostPerMile)}</TableCell>
                  <TableCell>{formatDate(cost.lastRepairDate)}</TableCell>
                  <TableCell>{formatNumber(cost.lastRepairMileage)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
