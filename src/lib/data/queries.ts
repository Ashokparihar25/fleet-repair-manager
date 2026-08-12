import { analyzeVehicleCost, invoiceDate, invoicePrimaryCategory, vehicleLabel } from "@/lib/analytics";
import { computeDiscrepancy } from "@/lib/discrepancy";
import { findDuplicateInvoices } from "@/lib/duplicates";
import { loadStore } from "@/lib/data/store";
import type {
  FleetStore,
  InvoiceFilters,
  InvoiceWithRelations,
  VehicleWithRelations,
} from "@/types";

export async function getStore(): Promise<FleetStore> {
  return loadStore();
}

export function hydrateInvoice(store: FleetStore, invoiceId: string): InvoiceWithRelations | null {
  const inv = store.invoices.find((i) => i.id === invoiceId);
  if (!inv) return null;
  return {
    ...inv,
    vehicle: store.vehicles.find((v) => v.id === inv.vehicle_id) ?? null,
    shop: store.repair_shops.find((s) => s.id === inv.repair_shop_id) ?? null,
    parts: store.invoice_parts.filter((p) => p.invoice_id === inv.id),
    labor: store.invoice_labor.filter((l) => l.invoice_id === inv.id),
    payments: store.payments.filter((p) => p.invoice_id === inv.id),
    documents: store.documents.filter((d) => d.invoice_id === inv.id),
  };
}

export function hydrateVehicle(store: FleetStore, vehicleId: string): VehicleWithRelations | null {
  const v = store.vehicles.find((x) => x.id === vehicleId);
  if (!v) return null;
  const invoices = store.invoices
    .filter((i) => i.vehicle_id === v.id)
    .sort((a, b) => (invoiceDate(b) ?? "").localeCompare(invoiceDate(a) ?? ""))
    .map((i) => hydrateInvoice(store, i.id)!)
    .filter(Boolean);
  return {
    ...v,
    client: store.clients?.find((c) => c.id === v.client_id) ?? null,
    invoices,
    mileage: store.mileage_history
      .filter((m) => m.vehicle_id === v.id)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)),
    warranties: store.warranty_records.filter((w) => w.vehicle_id === v.id),
    maintenance: store.maintenance_records.filter((m) => m.vehicle_id === v.id),
    documents: store.documents.filter((d) => d.vehicle_id === v.id || invoices.some((i) => i.id === d.invoice_id)),
    cost: analyzeVehicleCost(v, store.invoices, store.invoice_parts, store.invoice_labor),
  };
}

export function filterInvoices(store: FleetStore, filters: InvoiceFilters = {}) {
  return store.invoices.filter((inv) => {
    const v = store.vehicles.find((x) => x.id === inv.vehicle_id);
    const shop = store.repair_shops.find((s) => s.id === inv.repair_shop_id);
    const parts = store.invoice_parts.filter((p) => p.invoice_id === inv.id);
    const labor = store.invoice_labor.filter((l) => l.invoice_id === inv.id);
    const cat = invoicePrimaryCategory(store, inv.id);
    const date = invoiceDate(inv);
    const total = Number(inv.invoice_total ?? inv.calculated_total ?? 0);

    if (filters.vehicleId && inv.vehicle_id !== filters.vehicleId) return false;
    if (filters.fleetId && (v?.vehicle_id ?? "").toLowerCase() !== filters.fleetId.toLowerCase()) return false;
    if (filters.vin && !(v?.vin ?? "").toLowerCase().includes(filters.vin.toLowerCase())) return false;
    if (filters.shopId && inv.repair_shop_id !== filters.shopId) return false;
    if (filters.dateFrom && (!date || date < filters.dateFrom)) return false;
    if (filters.dateTo && (!date || date > filters.dateTo)) return false;
    if (filters.category && cat !== filters.category) return false;
    if (filters.paymentStatus && inv.payment_status !== filters.paymentStatus) return false;
    if (filters.technician && !(inv.technician_name ?? "").toLowerCase().includes(filters.technician.toLowerCase()))
      return false;
    if (filters.year && v?.year !== filters.year) return false;
    if (filters.make && (v?.make ?? "").toLowerCase() !== filters.make.toLowerCase()) return false;
    if (filters.model && (v?.model ?? "").toLowerCase() !== filters.model.toLowerCase()) return false;
    if (filters.minCost && total < Number(filters.minCost)) return false;
    if (filters.maxCost && total > Number(filters.maxCost)) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const blob = [
        inv.invoice_number,
        inv.customer_id,
        inv.customer_name,
        inv.technician_name,
        v?.vin,
        v?.vehicle_id,
        v?.license_plate,
        vehicleLabel(v),
        shop?.name,
        cat,
        ...parts.map((p) => `${p.part_description} ${p.part_number}`),
        ...labor.map((l) => l.labor_description),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

export function invoiceFlags(store: FleetStore, invoiceId: string) {
  const inv = store.invoices.find((i) => i.id === invoiceId);
  if (!inv) return { discrepancy: null, duplicates: [], mileageAnomaly: null as string | null };
  const discrepancy = computeDiscrepancy(inv);
  const duplicates = findDuplicateInvoices(inv, store.invoices);
  const mile = store.mileage_history.find((m) => m.invoice_id === inv.id);
  return {
    discrepancy,
    duplicates,
    mileageAnomaly: mile?.anomaly ? mile.anomaly_note : null,
  };
}
