import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, FileSearch } from "lucide-react";
import { categoryLabel } from "@/lib/categorize";
import { getStore, hydrateInvoice, invoiceFlags } from "@/lib/data/queries";
import { detectRepeatedRepairs } from "@/lib/repeats";
import { possibleWarrantyMatches, warrantiesOnInvoice } from "@/lib/warranty";
import { formatMoney, formatNumber } from "@/lib/money";
import { vehicleLabel } from "@/lib/analytics";
import { formatDate, paymentMethodLabel, paymentStatusLabel } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStore();
  const inv = hydrateInvoice(store, id);
  if (!inv) notFound();
  const flags = invoiceFlags(store, id);
  const repeats = inv.vehicle_id
    ? detectRepeatedRepairs(store.invoices, store.invoice_parts, store.invoice_labor, inv.vehicle_id)
    : [];
  const onWarranty = warrantiesOnInvoice(store, inv.id);
  const possibleWarranty = possibleWarrantyMatches(store, inv);
  const audit = store.audit_logs
    .filter((l) => l.entity_type === "invoice" && l.entity_id === inv.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const shop = inv.shop;
  const vehicle = inv.vehicle;

  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/invoices", label: "Invoices" }, { label: `#${inv.invoice_number ?? "—"}` }]}
        title={`${shop?.name ?? "Repair invoice"}`}
        description={`Invoice #${inv.invoice_number ?? "—"}`}
        actions={
          <>
            {onWarranty.length > 0 && <Badge variant="info">WARRANTY</Badge>}
            <Link href={`/invoices/${inv.id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
            {inv.source_document_id && (
              <a href={`/api/documents/${inv.source_document_id}/file`} target="_blank">
                <Button>View original invoice</Button>
              </a>
            )}
          </>
        }
      />

      <Card className="mb-6 overflow-hidden">
        <div className="bg-slate-900 px-6 py-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Repair shop</div>
              <div className="text-xl font-semibold">{shop?.name ?? "Unknown shop"}</div>
              <div className="mt-1 text-sm text-slate-300">
                {[shop?.address, shop?.city, shop?.state, shop?.zip].filter(Boolean).join(", ")}
              </div>
              <div className="text-xs text-slate-400">
                Phone {shop?.phone ?? "—"} · Fax {shop?.fax ?? "—"} · Reg {shop?.registration_number ?? "—"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Invoice</div>
              <div className="text-2xl font-semibold">#{inv.invoice_number ?? "—"}</div>
              <div className="text-sm text-slate-300">Printed {formatDate(inv.printed_date)}</div>
            </div>
          </div>
        </div>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Vehicle / Fleet ID" value={vehicle?.vehicle_id ?? "Not mapped"} />
          <Info
            label="Vehicle"
            value={vehicle ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") : "—"}
          />
          <Info label="VIN" value={vehicle?.vin ?? "—"} mono />
          <Info label="Odometer" value={inv.odometer_in != null ? formatNumber(inv.odometer_in) : "—"} />
          <Info label="Invoice date" value={formatDate(inv.invoice_date)} />
          <Info label="Work completed" value={formatDate(inv.work_completed_date)} />
          <Info label="Proposed completion" value={formatDate(inv.proposed_completion_date)} />
          <Info label="Customer ID" value={inv.customer_id ?? "—"} />
        </CardContent>
      </Card>

      {flags.discrepancy?.hasDiscrepancy && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>⚠ Invoice total discrepancy</AlertTitle>
          <AlertDescription>
            Expected: {formatMoney(flags.discrepancy.expectedTotal)} · Invoice:{" "}
            {formatMoney(flags.discrepancy.invoiceTotal)} · Difference: {formatMoney(flags.discrepancy.difference)}.
            The original invoice total was not modified.
          </AlertDescription>
        </Alert>
      )}
      {flags.duplicates.map((d) => (
        <Alert key={d.id} variant="warning" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Possible duplicate invoice</AlertTitle>
          <AlertDescription>
            Similar to{" "}
            <Link href={`/invoices/${d.id}`} className="font-medium underline">
              #{d.invoice_number}
            </Link>
            . Nothing was deleted automatically.
          </AlertDescription>
        </Alert>
      ))}
      {flags.mileageAnomaly && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Mileage anomaly</AlertTitle>
          <AlertDescription>{flags.mileageAnomaly}</AlertDescription>
        </Alert>
      )}
      {repeats.length > 0 && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Repeated repair</AlertTitle>
          <AlertDescription>
            {repeats.map((r) => `${r.component} (${r.invoices.map((i) => `#${i.number}`).join(", ")})`).join(" · ")}
          </AlertDescription>
        </Alert>
      )}
      {possibleWarranty.map((w) => (
        <Alert key={w.id} variant="warning" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Possible warranty repair</AlertTitle>
          <AlertDescription>
            {w.component ?? "Component"} may still be covered by {w.warranty_provider ?? "an existing warranty"}
            {w.warranty_end_date ? ` until ${formatDate(w.warranty_end_date)}` : ""}
            {w.warranty_mileage_limit != null ? ` / ${w.warranty_mileage_limit.toLocaleString()} mi` : ""}. Source invoice
            data was not changed.
          </AlertDescription>
        </Alert>
      ))}
      {onWarranty.length > 0 && (
        <Alert variant="success" className="mb-4">
          <AlertTitle>WARRANTY</AlertTitle>
          <AlertDescription>
            This invoice has warranty coverage recorded: {onWarranty.map((w) => w.component ?? w.warranty_provider).join(", ")}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Vehicle information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Info label="Fleet ID" value={vehicle?.vehicle_id ?? "—"} />
            <Info label="VIN" value={vehicle?.vin ?? "—"} mono />
            <Info label="Year" value={vehicle?.year?.toString() ?? "—"} />
            <Info label="Make" value={vehicle?.make ?? "—"} />
            <Info label="Model" value={vehicle?.model ?? "—"} />
            <Info label="Trim" value={vehicle?.trim ?? "—"} />
            <Info label="Mileage" value={formatNumber(inv.odometer_in)} />
            <Info label="License plate" value={vehicle?.license_plate ?? "—"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Invoice information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Info label="Invoice #" value={inv.invoice_number ?? "—"} />
            <Info label="Printed date" value={formatDate(inv.printed_date)} />
            <Info label="Customer name" value={inv.customer_name ?? "—"} />
            <Info label="License" value={[inv.license_number, inv.license_state].filter(Boolean).join(" ") || "—"} />
            <Info label="Repair shop" value={shop?.name ?? "—"} />
            <Info label="Technician" value={inv.technician_name ?? "—"} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Parts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Part #</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit price</TableHead>
                <TableHead>Extended</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inv.parts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No parts on this invoice.
                  </TableCell>
                </TableRow>
              ) : (
                inv.parts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.part_description}
                      {p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.part_number ?? "—"}</TableCell>
                    <TableCell>{p.quantity ?? "—"}</TableCell>
                    <TableCell>{formatMoney(p.unit_price)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(p.extended_price)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{categoryLabel(p.category)}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Labor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inv.labor.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No labor operations on this invoice.
                  </TableCell>
                </TableRow>
              ) : (
                inv.labor.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-pre-wrap">{l.labor_description}</TableCell>
                    <TableCell className="font-medium">{formatMoney(l.extended_amount)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{categoryLabel(l.labor_category)}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Financial summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Labor" value={formatMoney(inv.labor_total)} />
            <Row label="Parts" value={formatMoney(inv.parts_total)} />
            <Row label="Subtotal" value={formatMoney(inv.subtotal)} />
            <Row label="Tax" value={formatMoney(inv.tax)} />
            <Separator />
            <Row label="Invoice total (source)" value={formatMoney(inv.invoice_total)} strong />
            <Row label="Calculated total" value={formatMoney(inv.calculated_total)} />
            <Row label="Amount paid" value={formatMoney(inv.payments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2))} />
            <Row label="Balance due" value={formatMoney(inv.balance_due)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Info label="Payment status" value={paymentStatusLabel(inv.payment_status)} />
            <Info label="Payment method" value={paymentMethodLabel(inv.payment_method)} />
            {inv.payments.map((p) => (
              <div key={p.id} className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-medium">
                  {paymentMethodLabel(p.payment_method)} · {formatMoney(p.amount)}
                </div>
                <div className="text-xs text-muted-foreground">{formatDate(p.payment_date)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {inv.documents.length === 0 ? (
              <p className="text-muted-foreground">No original document attached yet.</p>
            ) : (
              inv.documents.map((d) => (
                <a
                  key={d.id}
                  href={`/api/documents/${d.id}/file`}
                  target="_blank"
                  className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted"
                >
                  <FileSearch className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{d.file_name}</div>
                    <div className="text-xs text-muted-foreground">{d.document_type}</div>
                  </div>
                </a>
              ))
            )}
            <Info label="OCR status" value={inv.ocr_status.replace("_", " ")} />
            <Info label="OCR confidence" value={inv.ocr_confidence != null ? `${inv.ocr_confidence}%` : "—"} />
            <Info label="Verification" value={inv.manually_verified ? "Manually verified" : "Needs verification"} />
            {vehicle && (
              <Link href={`/vehicles/${vehicle.id}`} className="block text-primary hover:underline">
                Open {vehicleLabel(vehicle)}
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {audit.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Audit trail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {audit.map((log) => {
              const user = store.profiles.find((p) => p.id === log.user_id);
              return (
                <div key={log.id} className="rounded-lg border px-3 py-2">
                  <div className="font-medium">
                    {log.field_name ? `${log.field_name} changed` : log.action} by {user?.full_name ?? "User"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {log.old_value ?? "—"} → {log.new_value ?? "—"} · {formatDate(log.created_at.slice(0, 10))}
                  </div>
                </div>
              );
            })}
            <Link href="/audit" className="text-xs text-primary hover:underline">
              View full audit log
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "mt-0.5 font-mono text-sm" : "mt-0.5 font-medium"}>{value}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-base font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
