import Link from "next/link";
import { categoryLabel } from "@/lib/categorize";
import { invoiceDate, vehicleLabel } from "@/lib/analytics";
import { getStore } from "@/lib/data/queries";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export default async function LaborPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.toLowerCase() : "";
  const store = await getStore();
  const rows = store.invoice_labor
    .map((l) => {
      const inv = store.invoices.find((i) => i.id === l.invoice_id);
      const v = store.vehicles.find((x) => x.id === inv?.vehicle_id);
      return { l, inv, v };
    })
    .filter(({ l, inv, v }) => {
      if (!q) return true;
      return [l.labor_description, l.labor_category, inv?.invoice_number, v?.vehicle_id, v?.vin]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => (invoiceDate(b.inv!) ?? "").localeCompare(invoiceDate(a.inv!) ?? ""));

  return (
    <div>
      <PageHeader
        title="Labor"
        description="Labor operations are stored independently from parts. Search descriptions such as “remove & replace” or “tie rod”."
      />
      <form
        className="mb-4"
        action="/labor"
      >
        <input
          name="q"
          defaultValue={typeof sp.q === "string" ? sp.q : ""}
          placeholder="Search labor description, category, invoice, VIN…"
          className="h-9 w-full rounded-md border bg-card px-3 text-sm"
        />
      </form>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ l, inv, v }) => (
              <TableRow key={l.id}>
                <TableCell>{formatDate(inv ? invoiceDate(inv) : null)}</TableCell>
                <TableCell>{vehicleLabel(v)}</TableCell>
                <TableCell className="max-w-xl whitespace-pre-wrap">{l.labor_description}</TableCell>
                <TableCell className="font-medium">{formatMoney(l.extended_amount)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{categoryLabel(l.labor_category)}</Badge>
                </TableCell>
                <TableCell>
                  {inv && (
                    <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                      #{inv.invoice_number}
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
