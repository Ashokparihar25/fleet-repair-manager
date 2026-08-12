import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addMoney, formatMoney, formatNumber } from "@/lib/money";
import { invoiceSpend, vehicleLabel } from "@/lib/analytics";
import { getStore } from "@/lib/data/queries";
import { vehicleStatusLabel } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientVehiclesImport } from "@/components/clients/client-vehicles-import";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStore();
  const client = store.clients.find((c) => c.id === id);
  if (!client) notFound();

  const vehicles = store.vehicles
    .filter((v) => v.client_id === client.id)
    .sort((a, b) => (a.vehicle_id ?? vehicleLabel(a)).localeCompare(b.vehicle_id ?? vehicleLabel(b)));
  const invs = store.invoices.filter(
    (i) => vehicles.some((v) => v.id === i.vehicle_id) && i.payment_status !== "voided",
  );
  const inShop = vehicles.filter((v) => v.status === "in_shop").length;
  const spend = addMoney(...invs.map(invoiceSpend));

  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/clients", label: "Clients" }, { label: client.name }]}
        title={client.name}
        description={client.legal_name ?? "Fleet customer"}
        actions={
          <>
            <Link href={`/clients/${client.id}/edit`}>
              <Button variant="outline">Edit client</Button>
            </Link>
            <Link href={`/vehicles/new?clientId=${client.id}`}>
              <Button>Add one vehicle</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-6">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Legal name" value={client.legal_name ?? "—"} />
          <Info label="Phone" value={client.phone ?? "—"} />
          <Info label="Email" value={client.email ?? "—"} />
          <Info
            label="Website"
            value={
              client.website ? (
                <a href={client.website} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                  {client.website.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "—"
              )
            }
          />
          <Info
            label="Address"
            value={[client.address, client.city, client.state, client.zip].filter(Boolean).join(", ") || "—"}
          />
          <Info label="Notes" value={client.notes ?? "—"} />
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vehicles" value={String(vehicles.length)} />
        <StatCard label="In shop" value={String(inShop)} />
        <StatCard label="Repair invoices" value={String(invs.length)} />
        <StatCard label="Repair spend" value={formatMoney(spend)} />
      </div>

      <Card className="mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fleet ID</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>VIN</TableHead>
              <TableHead>Plate</TableHead>
              <TableHead>Mileage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No cars yet. Use the form below to add the full Cardeed fleet.
                </TableCell>
              </TableRow>
            ) : (
              vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-semibold">{v.vehicle_id ?? "—"}</TableCell>
                  <TableCell>{[v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{v.vin ?? "—"}</TableCell>
                  <TableCell>{v.license_plate ?? "—"}</TableCell>
                  <TableCell>{formatNumber(v.current_mileage)}</TableCell>
                  <TableCell>
                    <Badge variant={v.status === "available" ? "success" : "warning"}>{vehicleStatusLabel(v.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/vehicles/${v.id}`} className="text-sm font-medium text-primary hover:underline">
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <ClientVehiclesImport clientId={client.id} clientName={client.name} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
