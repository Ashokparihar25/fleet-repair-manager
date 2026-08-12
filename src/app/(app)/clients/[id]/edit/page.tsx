import { notFound } from "next/navigation";
import { getStore } from "@/lib/data/queries";
import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/components/clients/client-form";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStore();
  const client = store.clients.find((c) => c.id === id);
  if (!client) notFound();
  return (
    <div>
      <PageHeader
        crumbs={[
          { href: "/clients", label: "Clients" },
          { href: `/clients/${id}`, label: client.name },
          { label: "Edit" },
        ]}
        title={`Edit ${client.name}`}
      />
      <ClientForm client={client} />
    </div>
  );
}
