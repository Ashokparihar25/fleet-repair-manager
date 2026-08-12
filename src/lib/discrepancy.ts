import { addMoney, subtractMoney, toDecimal } from "@/lib/money";
import type { Invoice, InvoiceDiscrepancy, InvoiceLabor, InvoicePart } from "@/types";

export function expectedInvoiceTotal(input: {
  partsTotal?: string | null;
  laborTotal?: string | null;
  tax?: string | null;
}): string | null {
  const parts = toDecimal(input.partsTotal);
  const labor = toDecimal(input.laborTotal);
  const tax = toDecimal(input.tax);
  if (!parts && !labor && !tax) return null;
  return addMoney(input.partsTotal, input.laborTotal, input.tax);
}

export function computeDiscrepancy(
  invoice: Pick<Invoice, "invoice_total" | "parts_total" | "labor_total" | "tax" | "calculated_total">,
): InvoiceDiscrepancy {
  const expected =
    invoice.calculated_total ??
    expectedInvoiceTotal({
      partsTotal: invoice.parts_total,
      laborTotal: invoice.labor_total,
      tax: invoice.tax,
    });
  const invoiceTotal = invoice.invoice_total;
  if (!expected || !invoiceTotal) {
    return {
      hasDiscrepancy: false,
      invoiceTotal,
      expectedTotal: expected,
      difference: null,
    };
  }
  const diff = subtractMoney(invoiceTotal, expected);
  const hasDiscrepancy = Math.abs(Number(diff)) >= 0.01;
  return {
    hasDiscrepancy,
    invoiceTotal,
    expectedTotal: expected,
    difference: hasDiscrepancy ? diff : "0.00",
  };
}

export function sumParts(parts: InvoicePart[]): string {
  return addMoney(...parts.map((p) => p.extended_price));
}

export function sumLabor(labor: InvoiceLabor[]): string {
  return addMoney(...labor.map((l) => l.extended_amount));
}
