import { money } from "@/lib/money";
import { normalizeVin } from "@/lib/vin";
import type { OcrExtractionResult, OcrPayload } from "@/types";

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Models sometimes return 0–1 fractions; the UI expects 0–100. */
function confidencePercent(v: unknown, fallback: number): number {
  const n = num(v);
  if (n == null) return fallback;
  if (n > 0 && n <= 1) return Math.round(n * 100);
  return Math.max(0, Math.min(100, Math.round(n)));
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function field<T>(source: unknown, normalized: T, confidence: number, verified = false) {
  return {
    source_value: source == null ? null : String(source),
    normalized_value: normalized,
    confidence,
    verified,
  };
}

export function emptyExtraction(): OcrExtractionResult {
  return {
    repair_shop: { name: null, address: null, phone: null, fax: null, michigan_registration: null },
    invoice: {
      invoice_number: null,
      printed_date: null,
      proposed_completion_date: null,
      work_completed_date: null,
      customer_name: null,
      customer_id: null,
      license_number: null,
      license_state: null,
      odometer_in: null,
      vin: null,
      original_estimate_amount: null,
      labor_total: null,
      parts_total: null,
      subtotal: null,
      tax: null,
      total: null,
      balance_due: null,
      payment_method: null,
      payment_amount: null,
    },
    vehicle: { year: null, make: null, model: null, trim: null, engine: null, vin: null },
    parts: [],
    labor: [],
    technician: { name: null, certification_number: null },
    field_confidence: {},
    overall_confidence: 0,
    ocr_payload: {},
  };
}

export function normalizeExtraction(raw: unknown, overallFallback = 50): OcrExtractionResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const shop = (r.repair_shop ?? {}) as Record<string, unknown>;
  const inv = (r.invoice ?? {}) as Record<string, unknown>;
  const veh = (r.vehicle ?? {}) as Record<string, unknown>;
  const tech = (r.technician ?? {}) as Record<string, unknown>;
  const confRaw = (r.field_confidence ?? {}) as Record<string, unknown>;
  const overall = confidencePercent(r.overall_confidence, overallFallback);
  const conf: Record<string, number> = {};
  for (const [key, value] of Object.entries(confRaw)) {
    conf[key] = confidencePercent(value, overall);
  }

  const vinSource = str(inv.vin) ?? str(veh.vin);
  const vinNorm = normalizeVin(vinSource);

  const parts = Array.isArray(r.parts) ? r.parts : [];
  const labor = Array.isArray(r.labor) ? r.labor : [];

  const result: OcrExtractionResult = {
    repair_shop: {
      name: str(shop.name),
      address: str(shop.address),
      phone: str(shop.phone),
      fax: str(shop.fax),
      michigan_registration: str(shop.michigan_registration),
    },
    invoice: {
      invoice_number: str(inv.invoice_number),
      printed_date: str(inv.printed_date),
      proposed_completion_date: str(inv.proposed_completion_date),
      work_completed_date: str(inv.work_completed_date),
      customer_name: str(inv.customer_name),
      customer_id: str(inv.customer_id),
      license_number: str(inv.license_number),
      license_state: str(inv.license_state),
      odometer_in: num(inv.odometer_in),
      vin: vinNorm,
      original_estimate_amount: money(str(inv.original_estimate_amount)),
      labor_total: money(str(inv.labor_total)),
      parts_total: money(str(inv.parts_total)),
      subtotal: money(str(inv.subtotal)),
      tax: money(str(inv.tax)),
      total: money(str(inv.total)),
      balance_due: money(str(inv.balance_due)),
      payment_method: str(inv.payment_method),
      payment_amount: money(str(inv.payment_amount)),
    },
    vehicle: {
      year: num(veh.year),
      make: str(veh.make),
      model: str(veh.model),
      trim: str(veh.trim),
      engine: str(veh.engine),
      vin: vinNorm,
    },
    parts: parts.map((p) => {
      const row = (p ?? {}) as Record<string, unknown>;
      return {
        description: str(row.description),
        part_number: str(row.part_number),
        quantity: num(row.quantity),
        unit_price: money(str(row.unit_price)),
        extended_price: money(str(row.extended_price)),
      };
    }),
    labor: labor.map((l) => {
      const row = (l ?? {}) as Record<string, unknown>;
      return {
        description: str(row.description),
        amount: money(str(row.amount)),
      };
    }),
    technician: {
      name: str(tech.name),
      certification_number: str(tech.certification_number),
    },
    field_confidence: conf,
    overall_confidence: overall,
    ocr_payload: {},
  };

  const payload: OcrPayload = {
    repair_shop: {
      name: field(shop.name, result.repair_shop.name, conf["repair_shop.name"] ?? overall),
      address: field(shop.address, result.repair_shop.address, conf["repair_shop.address"] ?? overall),
      phone: field(shop.phone, result.repair_shop.phone, conf["repair_shop.phone"] ?? overall),
      fax: field(shop.fax, result.repair_shop.fax, conf["repair_shop.fax"] ?? overall),
      michigan_registration: field(
        shop.michigan_registration,
        result.repair_shop.michigan_registration,
        conf["repair_shop.michigan_registration"] ?? overall,
      ),
    },
    invoice: {
      invoice_number: field(inv.invoice_number, result.invoice.invoice_number, conf["invoice.invoice_number"] ?? overall),
      vin: field(vinSource, result.invoice.vin, conf["invoice.vin"] ?? overall),
      total: field(inv.total, result.invoice.total, conf["invoice.total"] ?? overall),
      odometer_in: field(inv.odometer_in, result.invoice.odometer_in, conf["invoice.odometer_in"] ?? overall),
    },
    vehicle: {
      vin: field(vinSource, result.vehicle.vin, conf["vehicle.vin"] ?? overall),
      year: field(veh.year, result.vehicle.year, conf["vehicle.year"] ?? overall),
      make: field(veh.make, result.vehicle.make, conf["vehicle.make"] ?? overall),
      model: field(veh.model, result.vehicle.model, conf["vehicle.model"] ?? overall),
    },
    parts: result.parts.map((p, i) => ({
      description: field(parts[i]?.description, p.description, conf[`parts.${i}.description`] ?? overall),
      part_number: field(parts[i]?.part_number, p.part_number, conf[`parts.${i}.part_number`] ?? overall),
      quantity: field(parts[i]?.quantity, p.quantity, conf[`parts.${i}.quantity`] ?? overall),
      unit_price: field(parts[i]?.unit_price, p.unit_price, conf[`parts.${i}.unit_price`] ?? overall),
      extended_price: field(parts[i]?.extended_price, p.extended_price, conf[`parts.${i}.extended_price`] ?? overall),
    })),
    labor: result.labor.map((l, i) => ({
      description: field(labor[i]?.description, l.description, conf[`labor.${i}.description`] ?? overall),
      amount: field(labor[i]?.amount, l.amount, conf[`labor.${i}.amount`] ?? overall),
    })),
    technician: {
      name: field(tech.name, result.technician.name, conf["technician.name"] ?? overall),
      certification_number: field(
        tech.certification_number,
        result.technician.certification_number,
        conf["technician.certification_number"] ?? overall,
      ),
    },
  };
  result.ocr_payload = payload;
  return result;
}
