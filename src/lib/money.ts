import Decimal from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = string | number | Decimal | null | undefined;

export function toDecimal(value: MoneyInput): Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const d = new Decimal(value);
    if (!d.isFinite()) return null;
    return d;
  } catch {
    return null;
  }
}

export function money(value: MoneyInput): string | null {
  const d = toDecimal(value);
  if (!d) return null;
  return d.toFixed(2);
}

export function moneyOrZero(value: MoneyInput): string {
  return money(value) ?? "0.00";
}

export function addMoney(...values: MoneyInput[]): string {
  let sum = new Decimal(0);
  for (const v of values) {
    const d = toDecimal(v);
    if (d) sum = sum.plus(d);
  }
  return sum.toFixed(2);
}

export function subtractMoney(a: MoneyInput, b: MoneyInput): string {
  const da = toDecimal(a) ?? new Decimal(0);
  const db = toDecimal(b) ?? new Decimal(0);
  return da.minus(db).toFixed(2);
}

export function multiplyMoney(a: MoneyInput, b: MoneyInput): string {
  const da = toDecimal(a) ?? new Decimal(0);
  const db = toDecimal(b) ?? new Decimal(0);
  return da.times(db).toFixed(2);
}

export function divideMoney(a: MoneyInput, b: MoneyInput): string | null {
  const da = toDecimal(a);
  const db = toDecimal(b);
  if (!da || !db || db.isZero()) return null;
  return da.div(db).toFixed(2);
}

export function absMoney(value: MoneyInput): string {
  const d = toDecimal(value) ?? new Decimal(0);
  return d.abs().toFixed(2);
}

export function compareMoney(a: MoneyInput, b: MoneyInput): number {
  const da = toDecimal(a) ?? new Decimal(0);
  const db = toDecimal(b) ?? new Decimal(0);
  return da.comparedTo(db);
}

export function isZeroMoney(value: MoneyInput): boolean {
  const d = toDecimal(value);
  return !d || d.isZero();
}

export function formatMoney(value: MoneyInput, opts?: { fallback?: string }): string {
  const d = toDecimal(value);
  if (!d) return opts?.fallback ?? "—";
  const negative = d.isNegative();
  const abs = d.abs().toFixed(2);
  const [whole, frac] = abs.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${withCommas}.${frac}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US");
}

export function parseMoneyInput(raw: string): string | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  return money(cleaned);
}
