"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeMaintenance, deleteMaintenance, saveMaintenance } from "@/app/actions/fleet";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categorize";
import type { MaintenanceRecord, Vehicle } from "@/types";
import { vehicleLabel } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MaintenanceForm({
  vehicles,
  defaultVehicleId,
  record,
  compact,
}: {
  vehicles: Vehicle[];
  defaultVehicleId?: string;
  record?: MaintenanceRecord;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(!record && !compact ? true : false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      await saveMaintenance(formData);
      toast.success("Maintenance record saved");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex gap-2">
        <Button type="button" variant={record ? "outline" : "default"} size={record ? "sm" : "default"} onClick={() => setOpen(true)}>
          {record ? "Edit" : "+ Schedule maintenance"}
        </Button>
        {record && record.status !== "completed" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              await completeMaintenance(record.id);
              toast.success("Marked complete");
              router.refresh();
            }}
          >
            Complete
          </Button>
        )}
      </div>
    );
  }

  return (
    <form action={onSubmit} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2">
      {record && <input type="hidden" name="id" value={record.id} />}
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="vehicle_id">Vehicle</Label>
        <select id="vehicle_id" name="vehicle_id" defaultValue={record?.vehicle_id ?? defaultVehicleId ?? ""} className="h-9 w-full rounded-md border bg-card px-3 text-sm" required>
          <option value="">Select vehicle…</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {vehicleLabel(v)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={record?.title ?? ""} placeholder="Brake inspection" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <select id="category" name="category" defaultValue={record?.category ?? "preventive"} className="h-9 w-full rounded-md border bg-card px-3 text-sm">
          {CATEGORY_SLUGS.map((slug) => (
            <option key={slug} value={slug}>
              {CATEGORY_LABELS[slug]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="due_date">Due date</Label>
        <Input id="due_date" name="due_date" type="date" defaultValue={record?.due_date ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="due_mileage">Due mileage</Label>
        <Input id="due_mileage" name="due_mileage" type="number" defaultValue={record?.due_mileage?.toString() ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="completed_at">Completed date</Label>
        <Input id="completed_at" name="completed_at" type="date" defaultValue={record?.completed_at ?? ""} />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={record?.description ?? ""} />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={record?.notes ?? ""} />
      </div>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        {record && (
          <Button
            type="button"
            variant="destructive"
            onClick={async () => {
              if (!confirm("Delete this maintenance record?")) return;
              await deleteMaintenance(record.id);
              toast.success("Deleted");
              router.refresh();
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
