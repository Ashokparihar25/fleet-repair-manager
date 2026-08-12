"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Vehicle } from "@/types";
import { vehicleLabel } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReportsFilter({ vehicles }: { vehicles: Vehicle[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  return (
    <form
      className="mb-6 grid gap-2 rounded-xl border bg-card p-3 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const next = new URLSearchParams();
        for (const [k, v] of fd.entries()) if (String(v)) next.set(k, String(v));
        router.push(`/reports?${next.toString()}`);
      }}
    >
      <select name="vehicleId" defaultValue={sp.get("vehicleId") ?? ""} className="h-9 rounded-md border bg-card px-3 text-sm">
        <option value="">All vehicles</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {vehicleLabel(v)}
          </option>
        ))}
      </select>
      <Input name="dateFrom" type="date" defaultValue={sp.get("dateFrom") ?? ""} />
      <Input name="dateTo" type="date" defaultValue={sp.get("dateTo") ?? ""} />
      <Button type="submit">Run report</Button>
    </form>
  );
}
