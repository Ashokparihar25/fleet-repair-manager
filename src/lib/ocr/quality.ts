import type { OcrExtractionResult } from "@/types";

/** True when OCR returned essentially nothing usable for an invoice page. */
export function isEmptyExtraction(e: OcrExtractionResult | null | undefined): boolean {
  if (!e) return true;
  const inv = e.invoice;
  const hasIdentity = Boolean(inv.invoice_number || inv.vin || e.vehicle.vin);
  const hasMoney = Boolean(inv.total || inv.parts_total || inv.labor_total);
  const hasLines = e.parts.some((p) => p.description) || e.labor.some((l) => l.description);
  const hasCustomer = Boolean(inv.customer_name);
  return !(hasIdentity || hasMoney || hasLines || hasCustomer);
}

export function extractionHasVin(e: OcrExtractionResult | null | undefined): string | null {
  if (!e) return null;
  return e.invoice.vin || e.vehicle.vin || null;
}
