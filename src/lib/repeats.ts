import { categorizeRepair } from "@/lib/categorize";
import type { Invoice, InvoiceLabor, InvoicePart } from "@/types";

const REPEAT_WINDOW_DAYS = 90;

const COMPONENT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Tie Rod", pattern: /tie\s*rod/i },
  { label: "Brakes", pattern: /\b(brake|rotor|pads?)\b/i },
  { label: "Control Arm", pattern: /control\s*arm/i },
  { label: "Steering Gear", pattern: /steering\s*gear/i },
  { label: "Alternator", pattern: /alternator/i },
  { label: "Wheel Bearing", pattern: /wheel\s*bearing|hub\s*assembly/i },
  { label: "Strut", pattern: /\bstrut\b/i },
  { label: "Sway Bar", pattern: /sway|stabilizer/i },
];

export interface RepeatedRepair {
  vehicleId: string;
  component: string;
  category: string;
  invoices: Array<{ id: string; number: string | null; date: string | null }>;
  daysBetween: number | null;
}

function invoiceDate(inv: Invoice): string | null {
  return inv.work_completed_date ?? inv.invoice_date ?? inv.printed_date;
}

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(ms / 86_400_000);
}

export function detectRepeatedRepairs(
  invoices: Invoice[],
  parts: InvoicePart[],
  labor: InvoiceLabor[],
  vehicleId?: string,
): RepeatedRepair[] {
  const scoped = vehicleId ? invoices.filter((i) => i.vehicle_id === vehicleId) : invoices;
  const byVehicle = new Map<string, Invoice[]>();
  for (const inv of scoped) {
    if (!inv.vehicle_id) continue;
    const list = byVehicle.get(inv.vehicle_id) ?? [];
    list.push(inv);
    byVehicle.set(inv.vehicle_id, list);
  }

  const results: RepeatedRepair[] = [];

  for (const [vid, invs] of byVehicle) {
    for (const comp of COMPONENT_PATTERNS) {
      const matches = invs
        .filter((inv) => {
          const invParts = parts.filter((p) => p.invoice_id === inv.id);
          const invLabor = labor.filter((l) => l.invoice_id === inv.id);
          return (
            invParts.some((p) => comp.pattern.test(p.part_description)) ||
            invLabor.some((l) => comp.pattern.test(l.labor_description))
          );
        })
        .sort((a, b) => (invoiceDate(a) ?? "").localeCompare(invoiceDate(b) ?? ""));

      if (matches.length < 2) continue;

      for (let i = 1; i < matches.length; i++) {
        const prev = matches[i - 1];
        const curr = matches[i];
        const d1 = invoiceDate(prev);
        const d2 = invoiceDate(curr);
        const gap = d1 && d2 ? daysBetween(d1, d2) : null;
        if (gap !== null && gap > REPEAT_WINDOW_DAYS) continue;

        results.push({
          vehicleId: vid,
          component: comp.label,
          category: categorizeRepair(comp.label),
          invoices: matches.map((m) => ({
            id: m.id,
            number: m.invoice_number,
            date: invoiceDate(m),
          })),
          daysBetween: gap,
        });
        break;
      }
    }
  }

  return results;
}
