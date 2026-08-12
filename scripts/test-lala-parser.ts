import { readFileSync } from "fs";
import { parseLalaInvoice } from "../src/lib/ocr/lala-parser";

const raw = JSON.parse(readFileSync(process.argv[2] || "/tmp/lala-ocr-all.json", "utf8"));
const pages = raw.pages ?? [{ text: raw.text, lines: raw.lines, page: 1 }];
for (const p of pages) {
  const e = parseLalaInvoice(p.text ?? "", p.lines ?? []);
  console.log(
    JSON.stringify(
      {
        page: p.page,
        inv: e.invoice.invoice_number,
        vin: e.invoice.vin,
        odo: e.invoice.odometer_in,
        total: e.invoice.total,
        partsT: e.invoice.parts_total,
        laborT: e.invoice.labor_total,
        tax: e.invoice.tax,
        cust: e.invoice.customer_name,
        custId: e.invoice.customer_id,
        plate: e.invoice.license_number,
        vehicle: e.vehicle,
        tech: e.technician,
        dates: {
          printed: e.invoice.printed_date,
          proposed: e.invoice.proposed_completion_date,
          completed: e.invoice.work_completed_date,
        },
        parts: e.parts,
        labor: e.labor,
        conf: e.overall_confidence,
      },
      null,
      2,
    ),
  );
}
