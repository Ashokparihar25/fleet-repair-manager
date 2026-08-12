"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { RepairCategory, RepairShop } from "@/types";
import { Input } from "@/components/ui/input";

export function InvoiceFiltersBar({
  shops,
  categories,
}: {
  shops: RepairShop[];
  categories: RepairCategory[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const next = new URLSearchParams();
    for (const [k, v] of data.entries()) {
      if (String(v).trim()) next.set(k, String(v).trim());
    }
    router.push(`/invoices?${next.toString()}`);
  }

  return (
    <form
      className="mb-4 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
    >
      <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="Search…" />
      <Input name="fleetId" defaultValue={sp.get("fleetId") ?? ""} placeholder="Fleet ID" />
      <Input name="vin" defaultValue={sp.get("vin") ?? ""} placeholder="VIN" />
      <select name="shopId" defaultValue={sp.get("shopId") ?? ""} className="h-9 rounded-md border bg-card px-3 text-sm">
        <option value="">All shops</option>
        {shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select name="category" defaultValue={sp.get("category") ?? ""} className="h-9 rounded-md border bg-card px-3 text-sm">
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      <select name="paymentStatus" defaultValue={sp.get("paymentStatus") ?? ""} className="h-9 rounded-md border bg-card px-3 text-sm">
        <option value="">All payment statuses</option>
        <option value="paid">Paid</option>
        <option value="partially_paid">Partially paid</option>
        <option value="unpaid">Unpaid</option>
        <option value="voided">Voided</option>
      </select>
      <Input name="dateFrom" type="date" defaultValue={sp.get("dateFrom") ?? ""} />
      <Input name="dateTo" type="date" defaultValue={sp.get("dateTo") ?? ""} />
      <Input name="make" defaultValue={sp.get("make") ?? ""} placeholder="Make" />
      <Input name="model" defaultValue={sp.get("model") ?? ""} placeholder="Model" />
      <Input name="minCost" defaultValue={sp.get("minCost") ?? ""} placeholder="Min $" />
      <Input name="maxCost" defaultValue={sp.get("maxCost") ?? ""} placeholder="Max $" />
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Apply filters
        </button>
        <button
          type="button"
          className="h-9 rounded-md border px-4 text-sm"
          onClick={() => router.push("/invoices")}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
