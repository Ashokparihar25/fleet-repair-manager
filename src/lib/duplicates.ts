import { compareMoney } from "@/lib/money";
import type { Invoice } from "@/types";

export function findDuplicateInvoices(
  candidate: Pick<Invoice, "id" | "invoice_number" | "vehicle_id" | "repair_shop_id" | "invoice_date" | "invoice_total">,
  existing: Invoice[],
): Invoice[] {
  return existing.filter((inv) => {
    if (inv.id === candidate.id) return false;

    const numberMatch =
      inv.invoice_number &&
      candidate.invoice_number &&
      inv.invoice_number.trim() === candidate.invoice_number.trim();

    const vinVehicleMatch =
      inv.vehicle_id && candidate.vehicle_id && inv.vehicle_id === candidate.vehicle_id;

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

    if (numberMatch && (vinVehicleMatch || shopMatch)) return true;
    if (numberMatch && dateMatch && amountMatch) return true;
    if (vinVehicleMatch && shopMatch && dateMatch && amountMatch && numberMatch) return true;
    if (!numberMatch && vinVehicleMatch && shopMatch && dateMatch && amountMatch) return true;
    return false;
  });
}
