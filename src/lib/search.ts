import { invoicePrimaryCategory, vehicleLabel } from "@/lib/analytics";
import { categoryLabel } from "@/lib/categorize";
import type { FleetStore } from "@/types";

export type SearchHit = {
  type: "vehicle" | "invoice" | "part" | "labor" | "shop" | "client";
  id: string;
  href: string;
  title: string;
  subtitle: string;
};

function includes(hay: string | null | undefined, q: string): boolean {
  return (hay ?? "").toLowerCase().includes(q);
}

export function globalSearch(store: FleetStore, query: string, limit = 40): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];

  for (const c of store.clients ?? []) {
    if (includes(c.name, q) || includes(c.legal_name, q) || includes(c.email, q) || includes(c.phone, q) || includes(c.slug, q)) {
      hits.push({
        type: "client",
        id: c.id,
        href: `/clients/${c.id}`,
        title: c.name,
        subtitle: [c.legal_name, c.city, c.phone].filter(Boolean).join(" · "),
      });
    }
  }

  for (const v of store.vehicles) {
    const client = store.clients?.find((c) => c.id === v.client_id);
    if (
      includes(v.vin, q) ||
      includes(v.vehicle_id, q) ||
      includes(v.license_plate, q) ||
      includes(v.make, q) ||
      includes(v.model, q) ||
      includes(v.trim, q) ||
      includes(client?.name, q) ||
      includes(`${v.year} ${v.make} ${v.model}`, q)
    ) {
      hits.push({
        type: "vehicle",
        id: v.id,
        href: `/vehicles/${v.id}`,
        title: vehicleLabel(v),
        subtitle: [client?.name, v.vin, v.license_plate].filter(Boolean).join(" · "),
      });
    }
  }

  for (const inv of store.invoices) {
    const v = store.vehicles.find((x) => x.id === inv.vehicle_id);
    const shop = store.repair_shops.find((s) => s.id === inv.repair_shop_id);
    if (
      includes(inv.invoice_number, q) ||
      includes(inv.customer_id, q) ||
      includes(inv.customer_name, q) ||
      includes(inv.technician_name, q) ||
      includes(v?.vin, q) ||
      includes(v?.vehicle_id, q) ||
      includes(shop?.name, q) ||
      includes(categoryLabel(invoicePrimaryCategory(store, inv.id)), q)
    ) {
      hits.push({
        type: "invoice",
        id: inv.id,
        href: `/invoices/${inv.id}`,
        title: `Invoice #${inv.invoice_number ?? "—"}`,
        subtitle: [vehicleLabel(v), shop?.name, inv.invoice_date].filter(Boolean).join(" · "),
      });
    }
  }

  for (const p of store.invoice_parts) {
    if (includes(p.part_description, q) || includes(p.part_number, q) || includes(p.manufacturer_part_number, q) || includes(p.category, q)) {
      const inv = store.invoices.find((i) => i.id === p.invoice_id);
      const v = store.vehicles.find((x) => x.id === inv?.vehicle_id);
      hits.push({
        type: "part",
        id: p.id,
        href: `/invoices/${p.invoice_id}`,
        title: p.part_description,
        subtitle: [p.part_number, inv?.invoice_number ? `#${inv.invoice_number}` : null, vehicleLabel(v)]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }

  for (const l of store.invoice_labor) {
    if (includes(l.labor_description, q) || includes(l.labor_category, q)) {
      const inv = store.invoices.find((i) => i.id === l.invoice_id);
      const v = store.vehicles.find((x) => x.id === inv?.vehicle_id);
      hits.push({
        type: "labor",
        id: l.id,
        href: `/invoices/${l.invoice_id}`,
        title: l.labor_description,
        subtitle: [inv?.invoice_number ? `#${inv.invoice_number}` : null, vehicleLabel(v)]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }

  for (const s of store.repair_shops) {
    if (includes(s.name, q) || includes(s.city, q) || includes(s.registration_number, q)) {
      hits.push({
        type: "shop",
        id: s.id,
        href: `/shops/${s.id}`,
        title: s.name,
        subtitle: [s.city, s.state, s.registration_number].filter(Boolean).join(" · "),
      });
    }
  }

  const seen = new Set<string>();
  return hits
    .filter((h) => {
      const key = `${h.type}:${h.href}:${h.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
