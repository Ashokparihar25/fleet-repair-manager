import { getStore } from "@/lib/data/queries";
import { PageHeader } from "@/components/layout/page-header";
import { UploadWorkflow } from "@/components/invoices/upload-workflow";

export default async function UploadInvoicePage() {
  const store = await getStore();
  const existingInvoices = store.invoices.map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    vehicle_id: inv.vehicle_id,
    repair_shop_id: inv.repair_shop_id,
    invoice_date: inv.invoice_date,
    invoice_total: inv.invoice_total,
    vin: store.vehicles.find((v) => v.id === inv.vehicle_id)?.vin ?? null,
  }));

  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/invoices", label: "Invoices" }, { label: "Upload" }]}
        title="Upload invoices"
        description="Large PDFs upload straight to Storage (bypasses host size limits). OCR runs page-by-page; already-saved invoice numbers can be skipped."
      />
      <UploadWorkflow vehicles={store.vehicles} shops={store.repair_shops} existingInvoices={existingInvoices} />
    </div>
  );
}
