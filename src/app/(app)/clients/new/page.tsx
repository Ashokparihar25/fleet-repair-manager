import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/components/clients/client-form";

export default function NewClientPage() {
  return (
    <div>
      <PageHeader
        crumbs={[{ href: "/clients", label: "Clients" }, { label: "New" }]}
        title="Add client"
        description="Create a fleet customer, then add all of their cars on the client page."
      />
      <ClientForm />
    </div>
  );
}
