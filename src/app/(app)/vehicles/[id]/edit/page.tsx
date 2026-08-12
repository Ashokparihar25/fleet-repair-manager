import { notFound } from "next/navigation";
import { getStore } from "@/lib/data/queries";
import { vehicleLabel } from "@/lib/analytics";
import { PageHeader } from "@/components/layout/page-header";
import { VehicleForm } from "@/components/vehicles/vehicle-form";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStore();
  const vehicle = store.vehicles.find((v) => v.id === id);
  if (!vehicle) notFound();
  return (
    <div>
      <PageHeader
        crumbs={[
          { href: "/vehicles", label: "Vehicles" },
          { href: `/vehicles/${id}`, label: vehicle.vehicle_id ?? vehicleLabel(vehicle) },
          { label: "Edit" },
        ]}
        title="Edit vehicle"
      />
      <VehicleForm vehicle={vehicle} clients={store.clients} />
    </div>
  );
}
