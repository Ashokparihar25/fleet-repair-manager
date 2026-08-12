import { compareMoney } from "@/lib/money";
import type { Invoice } from "@/types";

export type InvoiceDupCandidate = Pick<
  Invoice,
  "id" | "invoice_number" | "vehicle_id" | "repair_shop_id" | "invoice_date" | "invoice_total"
> & {
  vin?: string | null;
};

export function normalizeInvoiceNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const n = value.trim().replace(/^#+/, "").replace(/\s+/g, "");
  return n || null;
}

export function findDuplicateInvoices(
  candidate: InvoiceDupCandidate,
  existing: InvoiceDupCandidate[],
): InvoiceDupCandidate[] {
  const candidateNumber = normalizeInvoiceNumber(candidate.invoice_number);
  return existing.filter((inv) => {
    if (inv.id === candidate.id) return false;

    const numberMatch =
      candidateNumber &&
      normalizeInvoiceNumber(inv.invoice_number) === candidateNumber;

    const vinVehicleMatch =
      (inv.vehicle_id && candidate.vehicle_id && inv.vehicle_id === candidate.vehicle_id) ||
      (inv.vin && candidate.vin && inv.vin === candidate.vin);

    const shopMatch =
      inv.repair_shop_id &&
      candidate.repair_shop_id &&
      inv.repair_shop_id === candidate.repair_shop_id;

    const dateMatch =
      inv.invoice_date && candidate.invoice_date && inv.invoice_date === candidate.invoice_date;

    const amountMatch =
      inv.invoice_total &&
      candidate.invoice_total &&
      compareMoney(inv.invoice_total, candidate.invoice_total) === 0;

    // Same RO/invoice number at same shop (or same vehicle) is a hard duplicate.
    if (numberMatch && (vinVehicleMatch || shopMatch)) return true;
    // Same number + date + amount (shop/vehicle unknown) still counts.
    if (numberMatch && dateMatch && amountMatch) return true;
    // Invoice numbers are unique enough for this fleet workflow — same # alone is a duplicate.
    if (numberMatch) return true;
    if (!numberMatch && vinVehicleMatch && shopMatch && dateMatch && amountMatch) return true;
    return false;
  });
}

/** Lightweight match for OCR review before a vehicle/shop id is chosen. */
export function findOcrDuplicate(input: {
  invoiceNumber?: string | null;
  vin?: string | null;
  repairShopId?: string | null;
  invoiceDate?: string | null;
  invoiceTotal?: string | null;
  existing: InvoiceDupCandidate[];
}): InvoiceDupCandidate | null {
  const hits = findDuplicateInvoices(
    {
      id: "__ocr__",
      invoice_number: input.invoiceNumber ?? null,
      vehicle_id: null,
      repair_shop_id: input.repairShopId ?? null,
      invoice_date: input.invoiceDate ?? null,
      invoice_total: input.invoiceTotal ?? null,
      vin: input.vin ?? null,
    },
    input.existing,
  );
  return hits[0] ?? null;
}
