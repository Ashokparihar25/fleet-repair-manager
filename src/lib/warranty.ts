import { categorizeRepair } from "@/lib/categorize";
import type { FleetStore, Invoice, WarrantyRecord } from "@/types";

export function isWarrantyActive(
  w: WarrantyRecord,
  atDate?: string | null,
  mileage?: number | null,
): boolean {
  if (!w.warranty_available) return false;
  if (w.warranty_start_date && atDate && atDate < w.warranty_start_date) return false;
  if (w.warranty_end_date && atDate && atDate > w.warranty_end_date) return false;
  if (w.warranty_mileage_limit != null && mileage != null && mileage > w.warranty_mileage_limit) {
    return false;
  }
  return true;
}

export function componentTextMatches(component: string | null | undefined, text: string): boolean {
  if (!component) return true;
  const c = component.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(c) || c.includes(t)) return true;
  return categorizeRepair(component) === categorizeRepair(text) && categorizeRepair(text) !== "other";
}

export function invoiceRepairText(store: FleetStore, invoiceId: string): string {
  const parts = store.invoice_parts.filter((p) => p.invoice_id === invoiceId).map((p) => p.part_description);
  const labor = store.invoice_labor.filter((l) => l.invoice_id === invoiceId).map((l) => l.labor_description);
  return [...parts, ...labor].join(" ");
}

export function warrantiesOnInvoice(store: FleetStore, invoiceId: string): WarrantyRecord[] {
  return store.warranty_records.filter((w) => w.invoice_id === invoiceId && w.warranty_available);
}

export function possibleWarrantyMatches(
  store: FleetStore,
  invoice: Invoice,
): WarrantyRecord[] {
  if (!invoice.vehicle_id) return [];
  const date = invoice.work_completed_date ?? invoice.invoice_date;
  const text = invoiceRepairText(store, invoice.id);
  return store.warranty_records.filter((w) => {
    if (w.vehicle_id !== invoice.vehicle_id) return false;
    if (w.invoice_id === invoice.id) return false;
    if (!isWarrantyActive(w, date, invoice.odometer_in)) return false;
    return componentTextMatches(w.component, text);
  });
}

export function warrantyStatusLabel(w: WarrantyRecord, atDate?: string | null, mileage?: number | null) {
  if (!w.warranty_available) return "Inactive";
  return isWarrantyActive(w, atDate, mileage) ? "Active" : "Expired";
}
