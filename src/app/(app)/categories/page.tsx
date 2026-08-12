import Link from "next/link";
import { spendByCategory } from "@/lib/analytics";
import { getStore } from "@/lib/data/queries";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategorySpendChart, CategoryCountChart } from "@/components/charts/dashboard-charts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function CategoriesPage() {
  const store = await getStore();
  const data = spendByCategory(store);

  return (
    <div>
      <PageHeader
        title="Repair categories"
        description="Automatic classification from part and labor descriptions. Override any line on the invoice."
      />
      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend by category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategorySpendChart data={data} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Repair lines by category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryCountChart data={data.map((c) => ({ name: c.name, count: c.count }))} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Parts $</TableHead>
              <TableHead>Labor $</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <TableRow key={c.category}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{formatMoney(c.parts.toFixed(2))}</TableCell>
                <TableCell>{formatMoney(c.labor.toFixed(2))}</TableCell>
                <TableCell>{formatMoney(c.total.toFixed(2))}</TableCell>
                <TableCell>{c.count}</TableCell>
                <TableCell>
                  <Link href={`/invoices?category=${c.category}`} className="text-sm text-primary hover:underline">
                    View invoices
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
