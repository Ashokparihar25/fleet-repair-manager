import { computeDiscrepancy } from "@/lib/discrepancy";
import { findDuplicateInvoices } from "@/lib/duplicates";
import { flagMileageAnomalies } from "@/lib/mileage";
import { resolveMaintenanceStatus } from "@/lib/maintenance";
import { detectRepeatedRepairs } from "@/lib/repeats";
import { possibleWarrantyMatches } from "@/lib/warranty";
import type { AlertItem, FleetStore } from "@/types";

const LOW_OCR = 70;

export function buildAlerts(store: FleetStore): AlertItem[] {
  const alerts: AlertItem[] = [];

  const mileage = flagMileageAnomalies(store.mileage_history);
  for (const m of mileage.filter((x) => x.anomaly)) {
    alerts.push({
      id: `mileage-${m.id}`,
      type: "mileage_anomaly",
      severity: "warning",
      title: "Mileage anomaly",
      message: m.anomaly_note ?? "Later invoice has lower mileage.",
      invoice_id: m.invoice_id,
      vehicle_id: m.vehicle_id,
      href: m.invoice_id ? `/invoices/${m.invoice_id}` : `/vehicles/${m.vehicle_id}`,
    });
  }

  for (const inv of store.invoices) {
    const dups = findDuplicateInvoices(inv, store.invoices);
    if (dups.length) {
      alerts.push({
        id: `dup-${inv.id}`,
        type: "duplicate_invoice",
        severity: "warning",
        title: "Possible duplicate invoice",
        message: `Invoice #${inv.invoice_number ?? "—"} may duplicate #${dups[0].invoice_number ?? dups[0].id.slice(0, 8)}.`,
        invoice_id: inv.id,
        vehicle_id: inv.vehicle_id,
        href: `/invoices/${inv.id}`,
      });
    }

    const disc = computeDiscrepancy(inv);
    if (disc.hasDiscrepancy) {
      alerts.push({
        id: `disc-${inv.id}`,
        type: "invoice_discrepancy",
        severity: "warning",
        title: "Invoice total discrepancy",
        message: `Invoice #${inv.invoice_number ?? "—"} total ${disc.invoiceTotal} vs expected ${disc.expectedTotal} (diff ${disc.difference}).`,
        invoice_id: inv.id,
        vehicle_id: inv.vehicle_id,
        href: `/invoices/${inv.id}`,
      });
    }

    if (!inv.vehicle_id) {
      alerts.push({
        id: `unkveh-${inv.id}`,
        type: "unknown_vehicle",
        severity: "critical",
        title: "Unknown vehicle",
        message: `Invoice #${inv.invoice_number ?? "—"} is not linked to a vehicle.`,
        invoice_id: inv.id,
        href: `/invoices/${inv.id}`,
      });
    } else {
      const v = store.vehicles.find((x) => x.id === inv.vehicle_id);
      if (v && !v.vin) {
        alerts.push({
          id: `vin-${inv.id}`,
          type: "missing_vin",
          severity: "warning",
          title: "Missing VIN",
          message: `Vehicle ${v.vehicle_id ?? v.id.slice(0, 8)} has no VIN.`,
          invoice_id: inv.id,
          vehicle_id: v.id,
          href: `/vehicles/${v.id}`,
        });
      }
    }

    if (!inv.repair_shop_id) {
      alerts.push({
        id: `shop-${inv.id}`,
        type: "unknown_shop",
        severity: "warning",
        title: "Unknown repair shop",
        message: `Invoice #${inv.invoice_number ?? "—"} has no repair shop.`,
        invoice_id: inv.id,
        href: `/invoices/${inv.id}`,
      });
    }

    if (
      inv.ocr_status === "needs_review" ||
      (inv.ocr_confidence != null && inv.ocr_confidence < LOW_OCR && !inv.manually_verified)
    ) {
      alerts.push({
        id: `ocr-${inv.id}`,
        type: "ocr_confidence_low",
        severity: "warning",
        title: "OCR confidence low",
        message: `Invoice #${inv.invoice_number ?? "—"} needs verification (confidence ${inv.ocr_confidence ?? "n/a"}).`,
        invoice_id: inv.id,
        href: `/invoices/${inv.id}`,
      });
    }

    const paid = store.payments
      .filter((p) => p.invoice_id === inv.id)
      .reduce((s, p) => s + Number(p.amount), 0);
    if (inv.payment_status !== "voided" && inv.payment_status !== "paid" && paid === 0) {
      alerts.push({
        id: `pay-${inv.id}`,
        type: "missing_payment",
        severity: inv.payment_status === "unpaid" ? "critical" : "warning",
        title: inv.balance_due && Number(inv.balance_due) > 0 ? "Balance due" : "Missing payment",
        message: `Invoice #${inv.invoice_number ?? "—"} is ${inv.payment_status.replace("_", " ")}.`,
        invoice_id: inv.id,
        href: `/invoices/${inv.id}`,
      });
    } else if (inv.balance_due && Number(inv.balance_due) > 0 && inv.payment_status !== "voided") {
      alerts.push({
        id: `bal-${inv.id}`,
        type: "balance_due",
        severity: "critical",
        title: "Balance due",
        message: `Invoice #${inv.invoice_number ?? "—"} has a balance due of $${inv.balance_due}.`,
        invoice_id: inv.id,
        href: `/invoices/${inv.id}`,
      });
    }

    if (!inv.invoice_number) {
      alerts.push({
        id: `num-${inv.id}`,
        type: "missing_invoice_number",
        severity: "warning",
        title: "Missing invoice number",
        message: "An invoice was saved without an invoice number.",
        invoice_id: inv.id,
        href: `/invoices/${inv.id}`,
      });
    }

    if (inv.odometer_in == null) {
      alerts.push({
        id: `odo-${inv.id}`,
        type: "missing_odometer",
        severity: "info",
        title: "Missing odometer",
        message: `Invoice #${inv.invoice_number ?? "—"} has no odometer reading.`,
        invoice_id: inv.id,
        href: `/invoices/${inv.id}`,
      });
    }
  }

  const repeats = detectRepeatedRepairs(store.invoices, store.invoice_parts, store.invoice_labor);
  for (const r of repeats) {
    const v = store.vehicles.find((x) => x.id === r.vehicleId);
    alerts.push({
      id: `rep-${r.vehicleId}-${r.component}`,
      type: "repeated_repair",
      severity: "warning",
      title: "Repeated repair",
      message: `${v?.vehicle_id ?? "Vehicle"} had ${r.component} repaired again${r.daysBetween != null ? ` within ${r.daysBetween} days` : ""}.`,
      vehicle_id: r.vehicleId,
      invoice_id: r.invoices[r.invoices.length - 1]?.id,
      href: `/vehicles/${r.vehicleId}`,
    });
  }

  for (const inv of store.invoices) {
    for (const w of possibleWarrantyMatches(store, inv)) {
      alerts.push({
        id: `war-${inv.id}-${w.id}`,
        type: "possible_warranty",
        severity: "info",
        title: "Possible warranty repair",
        message: `Invoice #${inv.invoice_number ?? "—"} may be covered by ${w.warranty_provider ?? "an existing"} warranty${w.component ? ` (${w.component})` : ""}.`,
        invoice_id: inv.id,
        vehicle_id: inv.vehicle_id,
        href: `/invoices/${inv.id}`,
      });
    }
  }

  for (const rec of store.maintenance_records) {
    const v = store.vehicles.find((x) => x.id === rec.vehicle_id);
    const status = resolveMaintenanceStatus(rec, v);
    if (status === "overdue" || status === "due") {
      alerts.push({
        id: `maint-${rec.id}`,
        type: status === "overdue" ? "overdue_maintenance" : "maintenance_due",
        severity: status === "overdue" ? "critical" : "warning",
        title: status === "overdue" ? "Overdue maintenance" : "Maintenance due soon",
        message: `${v?.vehicle_id ?? "Vehicle"}: ${rec.title}${rec.due_date ? ` (due ${rec.due_date})` : rec.due_mileage ? ` (due ${rec.due_mileage.toLocaleString()} mi)` : ""}.`,
        vehicle_id: rec.vehicle_id,
        href: `/maintenance`,
      });
    }
  }

  const seen = new Set<string>();
  return alerts.filter((a) => {
    const key = `${a.type}:${a.invoice_id ?? ""}:${a.vehicle_id ?? ""}:${a.title}:${a.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
