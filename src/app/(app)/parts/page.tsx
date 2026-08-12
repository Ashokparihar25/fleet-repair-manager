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
import { PartsSearch } from "@/components/parts/parts-search";

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.toLowerCase() : "";
  const store = await getStore();
  const rows = store.invoice_parts
    .map((p) => {
      const inv = store.invoices.find((i) => i.id === p.invoice_id);
      const v = store.vehicles.find((x) => x.id === inv?.vehicle_id);
      return { p, inv, v };
    })
    .filter(({ p, inv, v }) => {
      if (!q) return true;
      return [p.part_description, p.part_number, p.manufacturer_part_number, p.category, inv?.invoice_number, v?.vehicle_id, v?.vin]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => (invoiceDate(b.inv!) ?? "").localeCompare(invoiceDate(a.inv!) ?? ""));

  return (
    <div>
      <PageHeader title="Parts" description="Every part line from every invoice. Part numbers are optional and formats are preserved." />
      <PartsSearch />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Part #</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Extended</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ p, inv, v }) => (
              <TableRow key={p.id}>
                <TableCell>{formatDate(inv ? invoiceDate(inv) : null)}</TableCell>
                <TableCell>{vehicleLabel(v)}</TableCell>
                <TableCell>{p.part_description}</TableCell>
                <TableCell className="font-mono text-xs">{p.part_number ?? "—"}</TableCell>
                <TableCell>{p.quantity ?? "—"}</TableCell>
                <TableCell>{formatMoney(p.unit_price)}</TableCell>
                <TableCell>{formatMoney(p.extended_price)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{categoryLabel(p.category)}</Badge>
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
