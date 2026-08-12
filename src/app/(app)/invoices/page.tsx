import Link from "next/link";
import { categoryLabel } from "@/lib/categorize";
import { invoiceDate, invoicePrimaryCategory, vehicleLabel } from "@/lib/analytics";
import { filterInvoices, getStore } from "@/lib/data/queries";
import { formatMoney, formatNumber } from "@/lib/money";
import { formatDate, paymentStatusLabel } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceFiltersBar } from "@/components/invoices/invoice-filters";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const store = await getStore();
  const invs = filterInvoices(store, {
    q: typeof sp.q === "string" ? sp.q : undefined,
    fleetId: typeof sp.fleetId === "string" ? sp.fleetId : undefined,
    vin: typeof sp.vin === "string" ? sp.vin : undefined,
    shopId: typeof sp.shopId === "string" ? sp.shopId : undefined,
    dateFrom: typeof sp.dateFrom === "string" ? sp.dateFrom : undefined,
    dateTo: typeof sp.dateTo === "string" ? sp.dateTo : undefined,
    category: typeof sp.category === "string" ? sp.category : undefined,
    paymentStatus: typeof sp.paymentStatus === "string" ? (sp.paymentStatus as never) : undefined,
    technician: typeof sp.technician === "string" ? sp.technician : undefined,
    make: typeof sp.make === "string" ? sp.make : undefined,
    model: typeof sp.model === "string" ? sp.model : undefined,
    minCost: typeof sp.minCost === "string" ? sp.minCost : undefined,
    maxCost: typeof sp.maxCost === "string" ? sp.maxCost : undefined,
    vehicleId: typeof sp.vehicleId === "string" ? sp.vehicleId : undefined,
  }).sort((a, b) => (invoiceDate(b) ?? "").localeCompare(invoiceDate(a) ?? ""));

  return (
    <div>
      <PageHeader
        title="Repair invoices"
        description="Parts and labor are stored separately, matching the LALA invoice format."
        actions={
          <>
            <Link href="/invoices/upload">
              <Button variant="outline">Upload invoice</Button>
            </Link>
            <Link href="/invoices/new">
              <Button>+ New invoice</Button>
            </Link>
          </>
        }
      />
      <InvoiceFiltersBar shops={store.repair_shops} categories={store.repair_categories} />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Fleet ID</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>VIN</TableHead>
              <TableHead>Shop</TableHead>
              <TableHead>Invoice date</TableHead>
              <TableHead>Work completed</TableHead>
              <TableHead>Mileage</TableHead>
              <TableHead>Repair type</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Verification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invs.map((inv) => {
              const v = store.vehicles.find((x) => x.id === inv.vehicle_id);
              const shop = store.repair_shops.find((s) => s.id === inv.repair_shop_id);
              const cat = invoicePrimaryCategory(store, inv.id);
              return (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link href={`/invoices/${inv.id}`} className="font-semibold text-primary hover:underline">
                      {inv.invoice_number ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{v?.vehicle_id ?? "—"}</TableCell>
                  <TableCell>{vehicleLabel(v)}</TableCell>
                  <TableCell className="font-mono text-[11px]">{v?.vin ?? "—"}</TableCell>
                  <TableCell>{shop?.name ?? "—"}</TableCell>
                  <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                  <TableCell>{formatDate(inv.work_completed_date)}</TableCell>
                  <TableCell>{formatNumber(inv.odometer_in)}</TableCell>
                  <TableCell>{categoryLabel(cat)}</TableCell>
                  <TableCell className="font-medium">{formatMoney(inv.invoice_total)}</TableCell>
                  <TableCell>
                    <Badge variant={inv.payment_status === "paid" ? "success" : inv.payment_status === "unpaid" ? "destructive" : "warning"}>
                      {paymentStatusLabel(inv.payment_status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {inv.manually_verified ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="warning">Needs review</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
