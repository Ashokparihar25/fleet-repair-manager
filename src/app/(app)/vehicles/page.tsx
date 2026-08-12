import Link from "next/link";
import { analyzeVehicleCost, invoiceDate, vehicleLabel } from "@/lib/analytics";
import { getStore } from "@/lib/data/queries";
import { formatMoney, formatNumber } from "@/lib/money";
import { formatDate, vehicleStatusLabel } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VehiclesFilters } from "@/components/vehicles/vehicles-filters";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.toLowerCase() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const store = await getStore();

  const rows = store.vehicles
    .map((v) => {
      const client = store.clients.find((c) => c.id === v.client_id) ?? null;
      const invs = store.invoices.filter((i) => i.vehicle_id === v.id && i.payment_status !== "voided");
      const cost = analyzeVehicleCost(v, store.invoices, store.invoice_parts, store.invoice_labor);
      const last = invs
        .map((i) => invoiceDate(i))
        .filter((d): d is string => Boolean(d))
        .sort()
        .at(-1);
      return { v, client, invs, cost, last };
    })
    .filter(({ v, client }) => {
      if (status && v.status !== status) return false;
      if (!q) return true;
      return [v.vehicle_id, v.vin, v.make, v.model, v.trim, v.license_plate, String(v.year), client?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => (a.v.vehicle_id ?? vehicleLabel(a.v)).localeCompare(b.v.vehicle_id ?? vehicleLabel(b.v)));

  return (
    <div>
      <PageHeader
        title="Vehicles"
        description="VIN is the primary identity. Fleet IDs (A010, A016, …) are mapped manually."
        actions={
          <Link href="/vehicles/new">
            <Button>Add vehicle</Button>
          </Link>
        }
      />
      <VehiclesFilters />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fleet ID</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>VIN</TableHead>
              <TableHead>Mileage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Repairs</TableHead>
              <TableHead>Repair cost</TableHead>
              <TableHead>Last repair</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ v, client, invs, cost, last }) => (
              <TableRow key={v.id}>
                <TableCell className="font-semibold">{v.vehicle_id ?? "—"}</TableCell>
                <TableCell>
                  {client ? (
                    <Link href={`/clients/${client.id}`} className="text-sm text-primary hover:underline">
                      {client.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{[v.year, v.make, v.model, v.trim].filter(Boolean).join(" ")}</div>
                  <div className="text-xs text-muted-foreground">{v.engine}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{v.vin ?? "—"}</TableCell>
                <TableCell>{formatNumber(v.current_mileage)}</TableCell>
                <TableCell>
                  <Badge variant={v.status === "available" ? "success" : "warning"}>{vehicleStatusLabel(v.status)}</Badge>
                </TableCell>
                <TableCell>{invs.length}</TableCell>
                <TableCell className="font-medium">{formatMoney(cost.totalRepairCost)}</TableCell>
                <TableCell>{formatDate(last)}</TableCell>
                <TableCell>
                  <Link href={`/vehicles/${v.id}`} className="text-sm font-medium text-primary hover:underline">
                    Open
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
