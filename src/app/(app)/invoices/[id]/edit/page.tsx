import { notFound } from "next/navigation";
import { getStore, hydrateInvoice } from "@/lib/data/queries";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStore();
  const invoice = hydrateInvoice(store, id);
  if (!invoice) notFound();
  return (
    <div>
      <PageHeader
        crumbs={[
          { href: "/invoices", label: "Invoices" },
          { href: `/invoices/${id}`, label: `#${invoice.invoice_number ?? "—"}` },
          { label: "Edit" },
        ]}
        title={`Edit invoice #${invoice.invoice_number ?? "—"}`}
        description="Source totals are preserved. Calculated totals are shown separately if they differ."
      />
      <InvoiceForm invoice={invoice} vehicles={store.vehicles} shops={store.repair_shops} />
    </div>
  );
}
