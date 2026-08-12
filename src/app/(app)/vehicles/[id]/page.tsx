import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryLabel } from "@/lib/categorize";
import { hydrateVehicle } from "@/lib/data/queries";
import { getStore } from "@/lib/data/queries";
import { detectRepeatedRepairs } from "@/lib/repeats";
import { formatMoney, formatNumber } from "@/lib/money";
import { invoiceDate, invoicePrimaryCategory, vehicleLabel } from "@/lib/analytics";
import { spendByCategory } from "@/lib/analytics";
import { formatDate, vehicleStatusLabel } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MileageLineChart } from "@/components/charts/dashboard-charts";
import { CategorySpendChart } from "@/components/charts/dashboard-charts";
import { WarrantyForm } from "@/components/warranty/warranty-form";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { isWarrantyActive, warrantyStatusLabel } from "@/lib/warranty";
import { maintenanceStatusLabel, resolveMaintenanceStatus } from "@/lib/maintenance";
import { AlertTriangle } from "lucide-react";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStore();
  const vehicle = hydrateVehicle(store, id);
  if (!vehicle) notFound();

  const repeats = detectRepeatedRepairs(store.invoices, store.invoice_parts, store.invoice_labor, vehicle.id);
  const mileAnomalies = vehicle.mileage.filter((m) => m.anomaly);
  const scopedStore = {
    ...store,
    invoices: store.invoices.filter((i) => i.vehicle_id === vehicle.id),
    invoice_parts: store.invoice_parts.filter((p) =>
      store.invoices.some((i) => i.id === p.invoice_id && i.vehicle_id === vehicle.id),
    ),
    invoice_labor: store.invoice_labor.filter((l) =>
      store.invoices.some((i) => i.id === l.invoice_id && i.vehicle_id === vehicle.id),
    ),
  };
  const cats = spendByCategory(scopedStore);

  return (
    <div>
      <PageHeader
        crumbs={[
          ...(vehicle.client
            ? [{ href: "/clients", label: "Clients" }, { href: `/clients/${vehicle.client.id}`, label: vehicle.client.name }]
            : [{ href: "/vehicles", label: "Vehicles" }]),
          { label: vehicle.vehicle_id ?? vehicleLabel(vehicle) },
        ]}
        title={vehicle.vehicle_id ? `${vehicle.vehicle_id}` : vehicleLabel(vehicle)}
        description={[vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")}
        actions={
          <>
            <Link href={`/vehicles/${vehicle.id}/edit`}>
              <Button variant="outline">Edit vehicle</Button>
            </Link>
            <Link href={`/invoices/new?vehicleId=${vehicle.id}`}>
              <Button>New invoice</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-6">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Info
            label="Client"
            value={
              vehicle.client ? (
                <Link href={`/clients/${vehicle.client.id}`} className="text-primary hover:underline">
                  {vehicle.client.name}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Info label="Fleet ID" value={vehicle.vehicle_id ?? "Not mapped"} />
          <Info label="VIN" value={vehicle.vin ?? "—"} mono />
          <Info label="Current mileage" value={formatNumber(vehicle.current_mileage)} />
          <Info label="Status" value={vehicleStatusLabel(vehicle.status)} />
          <Info label="Engine" value={vehicle.engine ?? "—"} />
          <Info label="License plate" value={vehicle.license_plate ?? "—"} />
          <Info label="Purchase price" value={formatMoney(vehicle.purchase_price)} />
          <Info label="Rental revenue" value={formatMoney(vehicle.rental_revenue_total)} />
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total repair cost" value={formatMoney(vehicle.cost.totalRepairCost)} />
        <StatCard label="Repair orders" value={String(vehicle.cost.numberOfRepairs)} />
        <StatCard label="Average repair cost" value={formatMoney(vehicle.cost.averageRepairCost)} />
        <StatCard
          label="Last repair"
          value={formatDate(vehicle.cost.lastRepairDate)}
          hint={vehicle.cost.lastRepairMileage ? `${formatNumber(vehicle.cost.lastRepairMileage)} mi` : undefined}
        />
      </div>

      {mileAnomalies.map((m) => (
        <Alert key={m.id} variant="warning" className="mb-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Mileage anomaly</AlertTitle>
          <AlertDescription>{m.anomaly_note}</AlertDescription>
        </Alert>
      ))}
      {repeats.map((r) => (
        <Alert key={`${r.component}`} variant="warning" className="mb-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Repeated repair — {r.component}</AlertTitle>
          <AlertDescription>
            Appears on invoices {r.invoices.map((i) => `#${i.number}`).join(", ")}
            {r.daysBetween != null ? ` (${r.daysBetween} days apart)` : ""}.
          </AlertDescription>
        </Alert>
      ))}

      <Tabs defaultValue="timeline">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="parts">Parts</TabsTrigger>
          <TabsTrigger value="labor">Labor</TabsTrigger>
          <TabsTrigger value="mileage">Mileage</TabsTrigger>
          <TabsTrigger value="cost">Cost analysis</TabsTrigger>
          <TabsTrigger value="warranty">Warranty</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Repair timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative border-l border-slate-200 pl-6">
                {vehicle.invoices.map((inv) => (
                  <li key={inv.id} className="mb-8 last:mb-0">
                    <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-primary" />
                    <div className="text-xs text-muted-foreground">{formatDate(invoiceDate(inv))}</div>
                    <Link href={`/invoices/${inv.id}`} className="text-base font-semibold hover:underline">
                      {categoryLabel(invoicePrimaryCategory(store, inv.id))} · Invoice #{inv.invoice_number}
                    </Link>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {inv.labor[0]?.labor_description ?? inv.parts[0]?.part_description ?? "Repair"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm">
                      <span className="font-semibold">{formatMoney(inv.invoice_total)}</span>
                      <span>{inv.odometer_in != null ? `${formatNumber(inv.odometer_in)} miles` : "No odometer"}</span>
                      <Badge variant={inv.payment_status === "paid" ? "success" : "warning"}>{inv.payment_status}</Badge>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Mileage</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(invoiceDate(inv))}</TableCell>
                    <TableCell>{categoryLabel(invoicePrimaryCategory(store, inv.id))}</TableCell>
                    <TableCell>{formatNumber(inv.odometer_in)}</TableCell>
                    <TableCell>{formatMoney(inv.invoice_total)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.payment_status === "paid" ? "success" : "warning"}>{inv.payment_status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="parts">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Part #</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Extended</TableHead>
                  <TableHead>Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.invoices.flatMap((inv) =>
                  inv.parts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(invoiceDate(inv))}</TableCell>
                      <TableCell>{p.part_description}</TableCell>
                      <TableCell className="font-mono text-xs">{p.part_number ?? "—"}</TableCell>
                      <TableCell>{p.quantity ?? "—"}</TableCell>
                      <TableCell>{formatMoney(p.extended_price)}</TableCell>
                      <TableCell>
                        <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                          #{inv.invoice_number}
                        </Link>
                      </TableCell>
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="labor">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.invoices.flatMap((inv) =>
                  inv.labor.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{formatDate(invoiceDate(inv))}</TableCell>
                      <TableCell>{l.labor_description}</TableCell>
                      <TableCell>{formatMoney(l.extended_amount)}</TableCell>
                      <TableCell>
                        <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                          #{inv.invoice_number}
                        </Link>
                      </TableCell>
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="mileage">
          <Card>
            <CardHeader>
              <CardTitle>Mileage history</CardTitle>
            </CardHeader>
            <CardContent>
              <MileageLineChart
                data={vehicle.mileage.map((m) => ({ date: formatDate(m.recorded_at), mileage: m.mileage }))}
              />
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Mileage</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Flag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.mileage.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{formatDate(m.recorded_at)}</TableCell>
                      <TableCell>{formatNumber(m.mileage)}</TableCell>
                      <TableCell>{m.source}</TableCell>
                      <TableCell>
                        {m.anomaly ? <Badge variant="warning">Anomaly</Badge> : <Badge variant="success">OK</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Total parts" value={formatMoney(vehicle.cost.totalPartsCost)} />
            <StatCard label="Total labor" value={formatMoney(vehicle.cost.totalLaborCost)} />
            <StatCard label="Total tax" value={formatMoney(vehicle.cost.totalTax)} />
            <StatCard label="Repair cost / mile" value={formatMoney(vehicle.cost.repairCostPerMile)} />
            <StatCard label="Repair cost / month" value={formatMoney(vehicle.cost.repairCostPerMonth)} />
            <StatCard label="Operating cost" value={formatMoney(vehicle.cost.totalOperatingCost)} />
            <StatCard label="Net revenue" value={formatMoney(vehicle.cost.netRevenue)} />
            <StatCard label="ROI" value={vehicle.cost.roi ?? "—"} hint="Requires purchase price + rental revenue" />
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Cost by category</CardTitle>
            </CardHeader>
            <CardContent>
              <CategorySpendChart data={cats} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warranty">
          <Card>
            <CardHeader>
              <CardTitle>Warranty records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                When a component is under warranty, later repairs for the same part will show a possible warranty warning.
                LALA invoices did not print warranty terms — add them here only when the shop provides coverage.
              </p>
              <WarrantyForm vehicleId={vehicle.id} invoices={vehicle.invoices} />
              {vehicle.warranties.length === 0 ? (
                <p className="text-sm text-muted-foreground">No warranty records on this vehicle.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Mile limit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicle.warranties.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">
                          {w.component ?? "—"}{" "}
                          {w.warranty_available && isWarrantyActive(w, new Date().toISOString().slice(0, 10), vehicle.current_mileage) && (
                            <Badge variant="info">WARRANTY</Badge>
                          )}
                        </TableCell>
                        <TableCell>{w.warranty_provider ?? "—"}</TableCell>
                        <TableCell>{formatDate(w.warranty_start_date)}</TableCell>
                        <TableCell>{formatDate(w.warranty_end_date)}</TableCell>
                        <TableCell>{formatNumber(w.warranty_mileage_limit)}</TableCell>
                        <TableCell>
                          <Badge variant={warrantyStatusLabel(w, new Date().toISOString().slice(0, 10), vehicle.current_mileage) === "Active" ? "success" : "warning"}>
                            {warrantyStatusLabel(w, new Date().toISOString().slice(0, 10), vehicle.current_mileage)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <WarrantyForm vehicleId={vehicle.id} invoices={vehicle.invoices} warranty={w} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MaintenanceForm vehicles={store.vehicles} defaultVehicleId={vehicle.id} compact />
              {vehicle.maintenance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scheduled maintenance for this vehicle.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Due mileage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicle.maintenance.map((rec) => {
                      const status = resolveMaintenanceStatus(rec, vehicle);
                      return (
                        <TableRow key={rec.id}>
                          <TableCell className="font-medium">{rec.title}</TableCell>
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
        </TabsContent>

        <TabsContent value="docs">
          <Card>
            <CardContent className="p-5">
              {vehicle.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No original documents uploaded yet. Upload invoices from Repair Invoices → Upload Invoice. Original
                  PDFs/images are never deleted when OCR data is edited.
                </p>
              ) : (
                <ul className="space-y-2">
                  {vehicle.documents.map((d) => (
                    <li key={d.id}>
                      <Link href={`/documents`} className="text-sm font-medium text-primary hover:underline">
                        {d.file_name}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{d.document_type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "mt-1 font-mono text-sm" : "mt-1 font-medium"}>{value}</div>
    </div>
  );
}
