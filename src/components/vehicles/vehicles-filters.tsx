"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function VehiclesFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/vehicles?${next.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
      <Input
        defaultValue={sp.get("q") ?? ""}
        placeholder="Search fleet ID, VIN, make, model, plate…"
        onKeyDown={(e) => {
          if (e.key === "Enter") update("q", (e.target as HTMLInputElement).value);
        }}
      />
      <select
        className="h-9 rounded-md border bg-card px-3 text-sm"
        defaultValue={sp.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
      >
        <option value="">All statuses</option>
        <option value="available">Available</option>
        <option value="in_shop">In shop</option>
        <option value="out_of_service">Out of service</option>
        <option value="pending_inspection">Pending inspection</option>
        <option value="sold">Sold</option>
      </select>
    </div>
  );
}
