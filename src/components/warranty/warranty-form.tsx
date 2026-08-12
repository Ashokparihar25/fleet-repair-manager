"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveWarranty, deleteWarranty } from "@/app/actions/fleet";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/categorize";
import type { Invoice, WarrantyRecord } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WarrantyForm({
  vehicleId,
  invoices,
  warranty,
}: {
  vehicleId: string;
  invoices: Invoice[];
  warranty?: WarrantyRecord;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(!warranty);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      await saveWarranty(formData);
      toast.success("Warranty saved");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save warranty");
    } finally {
      setPending(false);
    }
  }

  if (!open && !warranty) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Add warranty
      </Button>
    );
  }
  if (!open && warranty) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
    );
  }

  return (
    <form action={onSubmit} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2">
      {warranty && <input type="hidden" name="id" value={warranty.id} />}
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <div className="space-y-1.5">
        <Label htmlFor="component">Component</Label>
        <Input id="component" name="component" defaultValue={warranty?.component ?? ""} placeholder="Tie Rod End" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="warranty_provider">Provider</Label>
        <Input id="warranty_provider" name="warranty_provider" defaultValue={warranty?.warranty_provider ?? ""} placeholder="LALA AUTO REPAIR LLC" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <select id="category" name="category" defaultValue={warranty?.category ?? ""} className="h-9 w-full rounded-md border bg-card px-3 text-sm">
          <option value="">Select…</option>
          {CATEGORY_SLUGS.map((slug) => (
            <option key={slug} value={slug}>
              {CATEGORY_LABELS[slug]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invoice_id">Originating invoice (optional)</Label>
        <select id="invoice_id" name="invoice_id" defaultValue={warranty?.invoice_id ?? ""} className="h-9 w-full rounded-md border bg-card px-3 text-sm">
          <option value="">None</option>
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              #{inv.invoice_number ?? inv.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="warranty_start_date">Start date</Label>
        <Input id="warranty_start_date" name="warranty_start_date" type="date" defaultValue={warranty?.warranty_start_date ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="warranty_end_date">End date</Label>
        <Input id="warranty_end_date" name="warranty_end_date" type="date" defaultValue={warranty?.warranty_end_date ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="warranty_mileage_limit">Mileage limit</Label>
        <Input id="warranty_mileage_limit" name="warranty_mileage_limit" type="number" defaultValue={warranty?.warranty_mileage_limit?.toString() ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="warranty_available">Available</Label>
        <select id="warranty_available" name="warranty_available" defaultValue={warranty?.warranty_available === false ? "false" : "true"} className="h-9 w-full rounded-md border bg-card px-3 text-sm">
          <option value="true">Yes — WARRANTY</option>
          <option value="false">No / expired</option>
        </select>
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="warranty_notes">Notes</Label>
        <Textarea id="warranty_notes" name="warranty_notes" defaultValue={warranty?.warranty_notes ?? ""} />
      </div>
      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save warranty"}</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        {warranty && (
          <Button
            type="button"
            variant="destructive"
            onClick={async () => {
              if (!confirm("Delete this warranty record?")) return;
              await deleteWarranty(warranty.id);
              toast.success("Warranty deleted");
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
