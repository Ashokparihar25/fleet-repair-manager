import { getStore } from "@/lib/data/queries";
import { PageHeader } from "@/components/layout/page-header";
import { VehicleForm } from "@/components/vehicles/vehicle-form";

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const clientId = typeof sp.clientId === "string" ? sp.clientId : undefined;
  const store = await getStore();
  const client = clientId ? store.clients.find((c) => c.id === clientId) : null;
  return (
    <div>
      <PageHeader
        crumbs={
          client
            ? [
                { href: "/clients", label: "Clients" },
                { href: `/clients/${client.id}`, label: client.name },
                { label: "New vehicle" },
              ]
            : [{ href: "/vehicles", label: "Vehicles" }, { label: "New" }]
        }
        title={client ? `Add vehicle · ${client.name}` : "Add vehicle"}
        description="VIN is required whenever available. Fleet ID can be mapped later."
      />
      <VehicleForm clients={store.clients} defaultClientId={clientId} />
    </div>
  );
}
