import { addMonths, differenceInCalendarMonths, min as minDate, parseISO } from "date-fns";
import { categoryLabel, primaryCategoryFromLines } from "@/lib/categorize";
import { addMoney, divideMoney, formatMoney, moneyOrZero, subtractMoney, toDecimal } from "@/lib/money";
import type {
  DashboardStats,
  FleetStore,
  Invoice,
  InvoiceLabor,
  InvoicePart,
  Vehicle,
  VehicleCostAnalysis,
} from "@/types";

export function invoiceDate(inv: Invoice): string | null {
  return inv.work_completed_date ?? inv.invoice_date ?? inv.printed_date;
}

export function vehicleLabel(v: Vehicle | null | undefined): string {
  if (!v) return "Unknown vehicle";
  const yearMakeModel = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  if (v.vehicle_id && yearMakeModel) return `${v.vehicle_id} · ${yearMakeModel}`;
  if (v.vehicle_id) return v.vehicle_id;
  if (yearMakeModel) return yearMakeModel;
  if (v.vin) return v.vin;
  return "Unnamed vehicle";
}

export function invoiceSpend(inv: Invoice): string {
  return moneyOrZero(inv.invoice_total ?? inv.calculated_total);
}

export function analyzeVehicleCost(
  vehicle: Vehicle,
  invoices: Invoice[],
  _parts: InvoicePart[],
  _labor: InvoiceLabor[],
): VehicleCostAnalysis {
  const invs = invoices.filter((i) => i.vehicle_id === vehicle.id && i.payment_status !== "voided");
  const totalParts = addMoney(...invs.map((i) => i.parts_total));
  const totalLabor = addMoney(...invs.map((i) => i.labor_total));
  const totalTax = addMoney(...invs.map((i) => i.tax));
  const totalRepair = addMoney(...invs.map((i) => invoiceSpend(i)));
  const count = invs.length;
  const avg = count > 0 ? divideMoney(totalRepair, count) : "0.00";

  const dated = invs
    .map((i) => ({ inv: i, date: invoiceDate(i) }))
    .filter((x): x is { inv: Invoice; date: string } => Boolean(x.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const last = dated[dated.length - 1] ?? null;
  const first = dated[0] ?? null;

  let costPerMonth: string | null = null;
  if (first && last) {
    const months = Math.max(1, differenceInCalendarMonths(parseISO(last.date), parseISO(first.date)) + 1);
    costPerMonth = divideMoney(totalRepair, months);
  } else if (count > 0) {
    costPerMonth = totalRepair;
  }

  const mileages = invs
    .map((i) => i.odometer_in)
    .filter((m): m is number => typeof m === "number");
  const minMile = mileages.length ? Math.min(...mileages) : vehicle.current_mileage;
  const maxMile = vehicle.current_mileage ?? (mileages.length ? Math.max(...mileages) : null);
  let costPerMile: string | null = null;
  if (minMile != null && maxMile != null && maxMile > minMile) {
    costPerMile = divideMoney(totalRepair, maxMile - minMile);
  }

  const purchase = vehicle.purchase_price;
  const rental = vehicle.rental_revenue_total;
  const operating = purchase ? addMoney(purchase, totalRepair) : totalRepair;
  const net = rental ? subtractMoney(rental, operating) : null;
  const roi =
    rental && purchase && toDecimal(purchase) && !toDecimal(purchase)!.isZero()
      ? divideMoney(subtractMoney(rental, operating), purchase)
      : null;

  return {
    vehicleId: vehicle.id,
    fleetId: vehicle.vehicle_id,
    totalPartsCost: totalParts,
    totalLaborCost: totalLabor,
    totalTax,
    totalRepairCost: totalRepair,
    numberOfRepairs: count,
    averageRepairCost: avg ?? "0.00",
    repairCostPerMile: costPerMile,
    repairCostPerMonth: costPerMonth,
    lastRepairDate: last?.date ?? null,
    lastRepairMileage: last?.inv.odometer_in ?? vehicle.current_mileage,
    purchasePrice: purchase,
    totalRepairInvestment: totalRepair,
    totalOperatingCost: purchase ? operating : null,
    rentalRevenue: rental,
    netRevenue: net,
    roi,
  };
}

export function buildDashboardStats(store: FleetStore, now = new Date()): DashboardStats {
  const invs = store.invoices.filter((i) => i.payment_status !== "voided");
  const totalSpend = addMoney(...invs.map(invoiceSpend));
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = addMonths(parseISO(monthStart), 1);
  const yearStart = `${now.getFullYear()}-01-01`;

  const thisMonthInvs = invs.filter((i) => {
    const d = invoiceDate(i);
    return d && d >= monthStart && d < nextMonth.toISOString().slice(0, 10);
  });
  const thisYearInvs = invs.filter((i) => {
    const d = invoiceDate(i);
    return d && d >= yearStart;
  });

  const thisMonth = addMoney(...thisMonthInvs.map(invoiceSpend));
  const thisYear = addMoney(...thisYearInvs.map(invoiceSpend));
  const avg = invs.length ? divideMoney(totalSpend, invs.length) : "0.00";

  const byVehicle = new Map<string, string>();
  for (const inv of invs) {
    if (!inv.vehicle_id) continue;
    byVehicle.set(inv.vehicle_id, addMoney(byVehicle.get(inv.vehicle_id), invoiceSpend(inv)));
  }
  let mostExpensive: DashboardStats["mostExpensiveVehicle"] = null;
  for (const [vid, total] of byVehicle) {
    if (!mostExpensive || (toDecimal(total)?.greaterThan(toDecimal(mostExpensive.total) ?? 0) ?? false)) {
      const v = store.vehicles.find((x) => x.id === vid);
      mostExpensive = {
        id: vid,
        fleetId: v?.vehicle_id ?? null,
        label: vehicleLabel(v),
        total,
      };
    }
  }

  const categoryCounts = new Map<string, number>();
  for (const inv of invs) {
    const parts = store.invoice_parts.filter((p) => p.invoice_id === inv.id);
    const labor = store.invoice_labor.filter((l) => l.invoice_id === inv.id);
    const cat = primaryCategoryFromLines([
      ...parts.map((p) => p.part_description),
      ...labor.map((l) => l.labor_description),
    ]);
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }
  let mostCommon: DashboardStats["mostCommonRepair"] = null;
  for (const [slug, count] of categoryCounts) {
    if (!mostCommon || count > mostCommon.count) {
      mostCommon = { category: slug, name: categoryLabel(slug), count };
    }
  }

  const shopSpend = new Map<string, string>();
  for (const inv of invs) {
    if (!inv.repair_shop_id) continue;
    shopSpend.set(inv.repair_shop_id, addMoney(shopSpend.get(inv.repair_shop_id), invoiceSpend(inv)));
  }
  let topShop: DashboardStats["topRepairShop"] = null;
  for (const [sid, total] of shopSpend) {
    if (!topShop || (toDecimal(total)?.greaterThan(toDecimal(topShop.total) ?? 0) ?? false)) {
      const shop = store.repair_shops.find((s) => s.id === sid);
      topShop = { id: sid, name: shop?.name ?? "Unknown shop", total };
    }
  }

  return {
    totalVehicles: store.vehicles.length,
    repairInvoices: invs.length,
    totalRepairSpend: totalSpend,
    thisMonth,
    thisYear,
    averageRepairCost: avg ?? "0.00",
    mostExpensiveVehicle: mostExpensive,
    mostCommonRepair: mostCommon,
    topRepairShop: topShop,
  };
}

export function monthlySpend(invoices: Invoice[]) {
  const map = new Map<string, string>();
  for (const inv of invoices) {
    const d = invoiceDate(inv);
    if (!d) continue;
    const key = d.slice(0, 7);
    map.set(key, addMoney(map.get(key), invoiceSpend(inv)));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total: Number(total) }));
}

export function spendByVehicle(store: FleetStore) {
  return store.vehicles
    .map((v) => {
      const invs = store.invoices.filter((i) => i.vehicle_id === v.id && i.payment_status !== "voided");
      return {
        id: v.id,
        label: v.vehicle_id ?? vehicleLabel(v),
        fullLabel: vehicleLabel(v),
        total: Number(addMoney(...invs.map(invoiceSpend))),
        count: invs.length,
      };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.total - a.total);
}

export function spendByCategory(store: FleetStore) {
  const map = new Map<string, { parts: string; labor: string; count: number }>();
  for (const inv of store.invoices.filter((i) => i.payment_status !== "voided")) {
    const parts = store.invoice_parts.filter((p) => p.invoice_id === inv.id);
    const labor = store.invoice_labor.filter((l) => l.invoice_id === inv.id);
    for (const p of parts) {
      const cat = p.category ?? "other";
      const cur = map.get(cat) ?? { parts: "0.00", labor: "0.00", count: 0 };
      cur.parts = addMoney(cur.parts, p.extended_price);
      cur.count += 1;
      map.set(cat, cur);
    }
    for (const l of labor) {
      const cat = l.labor_category ?? "other";
      const cur = map.get(cat) ?? { parts: "0.00", labor: "0.00", count: 0 };
      cur.labor = addMoney(cur.labor, l.extended_amount);
      cur.count += 1;
      map.set(cat, cur);
    }
  }
  return [...map.entries()]
    .map(([slug, v]) => ({
      category: slug,
      name: categoryLabel(slug),
      parts: Number(v.parts),
      labor: Number(v.labor),
      total: Number(addMoney(v.parts, v.labor)),
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total);
}

export function partsVsLabor(store: FleetStore) {
  const invs = store.invoices.filter((i) => i.payment_status !== "voided");
  return [
    { name: "Parts", value: Number(addMoney(...invs.map((i) => i.parts_total))) },
    { name: "Labor", value: Number(addMoney(...invs.map((i) => i.labor_total))) },
    { name: "Tax", value: Number(addMoney(...invs.map((i) => i.tax))) },
  ];
}

export function mileageVsCost(store: FleetStore) {
  return store.vehicles
    .map((v) => {
      const invs = store.invoices.filter((i) => i.vehicle_id === v.id && i.payment_status !== "voided");
      return {
        id: v.id,
        label: v.vehicle_id ?? v.vin?.slice(-6) ?? "—",
        mileage: v.current_mileage ?? 0,
        cost: Number(addMoney(...invs.map(invoiceSpend))),
      };
    })
    .filter((x) => x.cost > 0);
}

export function invoicePrimaryCategory(store: FleetStore, invoiceId: string): string {
  const parts = store.invoice_parts.filter((p) => p.invoice_id === invoiceId);
  const labor = store.invoice_labor.filter((l) => l.invoice_id === invoiceId);
  return primaryCategoryFromLines([
    ...parts.map((p) => p.part_description),
    ...labor.map((l) => l.labor_description),
  ]);
}

export function formatUsd(n: number) {
  return formatMoney(n.toFixed(2));
}

export function earliestInvoiceDate(invoices: Invoice[]): Date | null {
  const dates = invoices.map(invoiceDate).filter((d): d is string => Boolean(d));
  if (!dates.length) return null;
  return minDate(dates.map((d) => parseISO(d)));
}
