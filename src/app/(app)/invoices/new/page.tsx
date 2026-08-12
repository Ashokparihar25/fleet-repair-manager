import { getStore } from "@/lib/data/queries";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const store = await getStore();
  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/invoices", label: "Invoices" }, { label: "New" }]}
        title="New invoice"
        description="Manual entry for invoices that cannot be OCR processed. Parts and labor are independent."
      />
      <InvoiceForm
        vehicles={store.vehicles}
        shops={store.repair_shops}
        defaultVehicleId={typeof sp.vehicleId === "string" ? sp.vehicleId : undefined}
      />
    </div>
  );
}
