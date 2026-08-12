import { getStore } from "@/lib/data/queries";
import { PageHeader } from "@/components/layout/page-header";
import { UploadWorkflow } from "@/components/invoices/upload-workflow";

export default async function UploadInvoicePage() {
  const store = await getStore();
  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/invoices", label: "Invoices" }, { label: "Upload" }]}
        title="Upload invoices"
        description="Store the original PDF/image, OCR extract parts and labor separately, match VIN, then verify before saving."
      />
      <UploadWorkflow vehicles={store.vehicles} shops={store.repair_shops} />
    </div>
  );
}
