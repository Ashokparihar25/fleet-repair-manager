import Link from "next/link";
import { addMoney, formatMoney } from "@/lib/money";
import { invoiceSpend } from "@/lib/analytics";
import { getStore } from "@/lib/data/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ClientsPage() {
  const store = await getStore();
  const rows = store.clients.map((client) => {
    const vehicles = store.vehicles.filter((v) => v.client_id === client.id);
    const invs = store.invoices.filter(
      (i) => vehicles.some((v) => v.id === i.vehicle_id) && i.payment_status !== "voided",
    );
    return {
      client,
      vehicles: vehicles.length,
      invoices: invs.length,
      spend: addMoney(...invs.map(invoiceSpend)),
    };
  });

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Each rental or fleet customer owns a vehicle list. VIN is still the matching key inside a client."
        actions={
          <Link href="/clients/new">
            <Button>Add client</Button>
          </Link>
        }
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Vehicles</TableHead>
              <TableHead>Invoices</TableHead>
              <TableHead>Repair spend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No clients yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ client, vehicles, invoices, spend }) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link href={`/clients/${client.id}`} className="font-semibold text-primary hover:underline">
                      {client.name}
                    </Link>
                    {client.legal_name && client.legal_name !== client.name && (
                      <div className="text-xs text-muted-foreground">{client.legal_name}</div>
                    )}
                  </TableCell>
                  <TableCell>{client.phone ?? "—"}</TableCell>
                  <TableCell>{[client.city, client.state].filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell>{vehicles}</TableCell>
                  <TableCell>{invoices}</TableCell>
                  <TableCell>{formatMoney(spend)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
