"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveVehicle } from "@/app/actions/fleet";
import type { FleetClient, Vehicle } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export function VehicleForm({
  vehicle,
  clients = [],
  defaultClientId,
}: {
  vehicle?: Vehicle;
  clients?: FleetClient[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const res = await saveVehicle(formData);
      toast.success("Vehicle saved");
      router.push(`/vehicles/${res.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save vehicle");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form action={onSubmit} className="grid gap-4 md:grid-cols-2">
          {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="client_id">Client</Label>
            <select
              id="client_id"
              name="client_id"
              defaultValue={vehicle?.client_id ?? defaultClientId ?? ""}
              className="h-9 w-full rounded-md border bg-card px-3 text-sm"
            >
              <option value="">No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Field label="Fleet ID" name="vehicle_id" defaultValue={vehicle?.vehicle_id} hint="Auxiliary label such as A010. VIN is the matching key." />
          <Field label="VIN" name="vin" defaultValue={vehicle?.vin} className="font-mono uppercase" />
          <Field label="Year" name="year" type="number" defaultValue={vehicle?.year?.toString()} />
          <Field label="Make" name="make" defaultValue={vehicle?.make} />
          <Field label="Model" name="model" defaultValue={vehicle?.model} />
          <Field label="Trim" name="trim" defaultValue={vehicle?.trim} />
          <Field label="Engine" name="engine" defaultValue={vehicle?.engine} />
          <Field label="Body style" name="body_style" defaultValue={vehicle?.body_style} />
          <Field label="License plate" name="license_plate" defaultValue={vehicle?.license_plate} />
          <Field label="State" name="state" defaultValue={vehicle?.state} />
          <Field label="Current mileage" name="current_mileage" type="number" defaultValue={vehicle?.current_mileage?.toString()} />
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select id="status" name="status" defaultValue={vehicle?.status ?? "available"} className="h-9 w-full rounded-md border bg-card px-3 text-sm">
              <option value="available">Available</option>
              <option value="in_shop">In shop</option>
              <option value="out_of_service">Out of service</option>
              <option value="pending_inspection">Pending inspection</option>
              <option value="sold">Sold</option>
            </select>
          </div>
          <Field label="Color" name="color" defaultValue={vehicle?.color} />
          <Field label="Purchase date" name="purchase_date" type="date" defaultValue={vehicle?.purchase_date ?? ""} />
          <Field label="Purchase price" name="purchase_price" defaultValue={vehicle?.purchase_price ?? ""} />
          <Field label="Acquisition source" name="acquisition_source" defaultValue={vehicle?.acquisition_source ?? ""} />
          <Field label="Rental revenue (total)" name="rental_revenue_total" defaultValue={vehicle?.rental_revenue_total ?? ""} />
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={vehicle?.notes ?? ""} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save vehicle"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  hint,
  className,
  defaultValue,
  ...props
}: Omit<ComponentProps<typeof Input>, "defaultValue"> & {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string | number | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className={className} defaultValue={defaultValue ?? ""} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
