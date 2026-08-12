import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { invoiceDate, invoicePrimaryCategory, vehicleLabel } from "@/lib/analytics";
import { categoryLabel } from "@/lib/categorize";
import { getStore } from "@/lib/data/queries";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const vehicleId = url.searchParams.get("vehicleId");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const store = await getStore();

  let invs = store.invoices.filter((i) => i.payment_status !== "voided");
  if (vehicleId) invs = invs.filter((i) => i.vehicle_id === vehicleId);
  if (dateFrom) invs = invs.filter((i) => (invoiceDate(i) ?? "") >= dateFrom);
  if (dateTo) invs = invs.filter((i) => (invoiceDate(i) ?? "") <= dateTo);

  const invoiceRows = invs.map((inv) => {
    const v = store.vehicles.find((x) => x.id === inv.vehicle_id);
    const shop = store.repair_shops.find((s) => s.id === inv.repair_shop_id);
    return {
      invoice_number: inv.invoice_number,
      date: invoiceDate(inv),
      fleet_id: v?.vehicle_id,
      vin: v?.vin,
      vehicle: vehicleLabel(v),
      shop: shop?.name,
      category: categoryLabel(invoicePrimaryCategory(store, inv.id)),
      mileage: inv.odometer_in,
      parts_total: inv.parts_total,
      labor_total: inv.labor_total,
      tax: inv.tax,
      invoice_total: inv.invoice_total,
      calculated_total: inv.calculated_total,
      payment_status: inv.payment_status,
      payment_method: inv.payment_method,
    };
  });

  const partRows = store.invoice_parts
    .filter((p) => invs.some((i) => i.id === p.invoice_id))
    .map((p) => {
      const inv = invs.find((i) => i.id === p.invoice_id);
      const v = store.vehicles.find((x) => x.id === inv?.vehicle_id);
      return {
        invoice_number: inv?.invoice_number,
        date: inv ? invoiceDate(inv) : null,
        fleet_id: v?.vehicle_id,
        vin: v?.vin,
        description: p.part_description,
        part_number: p.part_number,
        quantity: p.quantity,
        unit_price: p.unit_price,
        extended_price: p.extended_price,
        category: p.category,
      };
    });

  const laborRows = store.invoice_labor
    .filter((l) => invs.some((i) => i.id === l.invoice_id))
    .map((l) => {
      const inv = invs.find((i) => i.id === l.invoice_id);
      const v = store.vehicles.find((x) => x.id === inv?.vehicle_id);
      return {
        invoice_number: inv?.invoice_number,
        date: inv ? invoiceDate(inv) : null,
        fleet_id: v?.vehicle_id,
        vin: v?.vin,
        description: l.labor_description,
        amount: l.extended_amount,
        category: l.labor_category,
      };
    });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceRows), "Invoices");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partRows), "Parts");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(laborRows), "Labor");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(invoiceRows));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="fleet-repair-report.csv"',
      },
    });
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="fleet-repair-report.xlsx"',
    },
  });
}
