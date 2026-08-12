import Link from "next/link";
import { addMoney, formatMoney, divideMoney } from "@/lib/money";
import { invoiceSpend } from "@/lib/analytics";
import { getStore } from "@/lib/data/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ShopsPage() {
  const store = await getStore();
  const rows = store.repair_shops.map((shop) => {
    const invs = store.invoices.filter((i) => i.repair_shop_id === shop.id && i.payment_status !== "voided");
    const total = addMoney(...invs.map(invoiceSpend));
    return { shop, count: invs.length, total, avg: invs.length ? divideMoney(total, invs.length) : "0.00" };
  });

  return (
    <div>
      <PageHeader
        title="Repair shops"
        description="Multiple shops are supported. LALA AUTO REPAIR LLC is seeded from your invoices."
        actions={
          <>
            <Link href="/shops/compare">
              <Button variant="outline">Compare shops</Button>
            </Link>
            <Link href="/shops/new">
              <Button>Add shop</Button>
            </Link>
          </>
        }
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Registration</TableHead>
              <TableHead>Invoices</TableHead>
              <TableHead>Total spend</TableHead>
              <TableHead>Average</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ shop, count, total, avg }) => (
              <TableRow key={shop.id}>
                <TableCell>
                  <Link href={`/shops/${shop.id}`} className="font-semibold text-primary hover:underline">
                    {shop.name}
                  </Link>
                </TableCell>
                <TableCell>{[shop.city, shop.state].filter(Boolean).join(", ")}</TableCell>
                <TableCell>{shop.phone ?? "—"}</TableCell>
                <TableCell>{shop.registration_number ?? "—"}</TableCell>
                <TableCell>{count}</TableCell>
                <TableCell>{formatMoney(total)}</TableCell>
                <TableCell>{formatMoney(avg)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
