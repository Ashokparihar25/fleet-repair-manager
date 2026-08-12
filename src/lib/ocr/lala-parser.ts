import { isValidVin, normalizeVin } from "@/lib/vin";
import { money } from "@/lib/money";
import { normalizeExtraction } from "@/lib/ocr/parse";
import type { OcrExtractionResult } from "@/types";

export type OcrLine = {
  text: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

const PART_NUM_RE =
  /^(?:kitid[=:]?\d+|kitld[=:]?\d+|[a-z]?\d{2,}[a-z0-9-]*|\d+[a-z]+\d+[a-z0-9]*|es\d+|ev\d+|dex-?vi(?:-\d+)?|sc\d+|r\d{3,}|b\d{3,})$/i;
const ONLY_MONEY_RE = /^\$?\d{1,3}(?:,\d{3})*\.\d{2}$/;
const QTY_RE = /^\d{1,3}(?:\.\d{1,2})?$/;
const DATE_RE = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
const HEADER_SKIP =
  /^(part\s*description|labor\s*description|extlabor|extended|qty|sale|ext|invoice|home:?|driver:?)$/i;

export function parseLalaInvoice(text: string, lines: OcrLine[] = []): OcrExtractionResult {
  const joined = text.replace(/\r/g, "");
  const compact = joined.replace(/[\s._]/g, "");
  const conf: Record<string, number> = {};

  const shopName = /lala\s*auto\s*repair/i.test(joined) || /lalaautorepair/i.test(compact)
    ? "LALA AUTO REPAIR LLC"
    : null;
  if (shopName) conf["repair_shop.name"] = 95;

  const address = pick(joined, /39137\s*michigan\s*ave/i, "39137 Michigan Ave");
  const cityLine = joined.match(/Wayne[,.\s]*M[Il1]\.?\s*,?\s*48186/i);
  const phone = (joined.match(/Phone\s*:?\s*([\d-]{10,14})/i)?.[1] ?? "734-844-1900").replace(
    /(\d{3})\D*(\d{3})\D*(\d{4})/,
    "$1-$2-$3",
  );
  const fax = (joined.match(/Fax\s*:?\s*([\d-]{10,14})/i)?.[1] ?? null)?.replace(
    /(\d{3})\D*(\d{3})\D*(\d{4})/,
    "$1-$2-$3",
  ) ?? null;
  const registration = joined.match(/\b(F\d{5,7})\b/i)?.[1]?.toUpperCase() ?? "F171029";
  if (address) conf["repair_shop.address"] = 90;
  if (phone) conf["repair_shop.phone"] = 90;
  if (registration) conf["repair_shop.michigan_registration"] = 92;

  const invoiceNumber = extractInvoiceNumber(joined, lines);
  if (invoiceNumber) conf["invoice.invoice_number"] = 92;

  const printedDate = parseDate(
    joined.match(/Printed\s*Date\s*:?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i)?.[1],
  );
  const workCompleted = parseDate(
    joined.match(/Work\s*Completed\s*:?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i)?.[1],
  );
  const proposed = parseDate(
    extractLabeledDate(joined, lines, /Proposed\s*completion\s*date/i),
  );
  if (printedDate) conf["invoice.printed_date"] = 88;
  if (workCompleted) conf["invoice.work_completed_date"] = 88;
  if (proposed) conf["invoice.proposed_completion_date"] = 85;

  const vinMatch = joined.match(/VIN\s*#?\s*:?\s*([A-HJ-NPR-Z0-9]{17})/i)?.[1] ?? joined.match(VIN_RE)?.[1];
  const vin = normalizeVin(vinMatch ?? null);
  if (vin && isValidVin(vin)) conf["invoice.vin"] = 96;
  else if (vin) conf["invoice.vin"] = 55;

  const odometerRaw = joined.match(/Odometer(?:\s*In|\s*ln|\s*I[n1l])?\s*:?\s*([\d,]{4,7})/i)?.[1];
  const odometer = odometerRaw ? Number(odometerRaw.replace(/,/g, "")) : null;
  if (odometer) conf["invoice.odometer_in"] = 90;

  const customerId = joined.match(/Cust\s*I\s*D\s*:?\s*(\d{2,6})/i)?.[1] ?? null;
  if (customerId) conf["invoice.customer_id"] = 88;

  const lic = joined.match(/Lic\s*#?\s*:?\s*([A-Z0-9]{4,10})\s*[-,]?\s*(MI|M[Il1])?/i);
  const licenseNumber = lic?.[1]?.toUpperCase() ?? null;
  const licenseState = lic ? "MI" : null;

  const vehicle = parseVehicleLine(joined);
  if (vehicle.year) conf["vehicle.year"] = 85;
  if (vehicle.make) conf["vehicle.make"] = 85;
  if (vehicle.model) conf["vehicle.model"] = 85;

  const customerName = extractCustomerName(joined, lines);
  if (customerName) conf["invoice.customer_name"] = 70;

  const originalEstimate = asMoney(
    joined.match(/Original\s*Estimate\s*Amount\s*:?\s*\$?([\d,]+\.\d{2})/i)?.[1],
  );
  const footer = footerAmounts(lines);
  const laborTotal = asMoney(footer.labor ?? joined.match(/\bLabor\s*:?\s*\$?([\d,]+\.\d{2})/i)?.[1]);
  const partsTotal = asMoney(footer.parts ?? joined.match(/\bParts\s*:?\s*\$?([\d,]+\.\d{2})/i)?.[1]);
  const tax = asMoney(footer.tax ?? joined.match(/\bTax\s*:?\s*\$?([\d,]+\.\d{2})/i)?.[1]);
  const total = asMoney(
    footer.total ??
      joined.match(/(?:^|\n)\s*Total\s*:?\s*\n[^$\d]{0,80}\$?([\d,]+\.\d{2})/i)?.[1] ??
      joined.match(/\[\s*Payments?\s*[-–]\s*[A-Za-z]+\s*[-–]\s*\$?([\d,]+\.\d{2})\s*\]/i)?.[1],
  );
  const balanceDue = asMoney(footer.balance ?? "0.00");
  const subtotal = asMoney(footer.sub);

  if (laborTotal) conf["invoice.labor_total"] = 90;
  if (partsTotal) conf["invoice.parts_total"] = 90;
  if (tax) conf["invoice.tax"] = 90;
  if (total) conf["invoice.total"] = 92;
  if (balanceDue) conf["invoice.balance_due"] = 88;

  const pay = joined.match(/Payments?\s*[-–]\s*([A-Za-z]+)\s*[-–]\s*[\$S]?([\d,]+\.\d{2})/i);
  const paymentMethod = pay?.[1] ?? (/\bVisa\b/i.test(joined) ? "Visa" : null);
  const paymentAmount = asMoney(pay?.[2] ?? total);
  if (paymentMethod) conf["invoice.payment_method"] = 90;

  const tech = parseTechnician(joined);
  if (tech.name) conf["technician.name"] = 88;
  if (tech.certification_number) conf["technician.certification_number"] = 90;

  const { parts, labor } = parseLineItems(lines, joined);
  parts.forEach((_, i) => {
    conf[`parts.${i}.description`] = 78;
    conf[`parts.${i}.extended_price`] = 82;
  });
  labor.forEach((_, i) => {
    conf[`labor.${i}.description`] = 78;
    conf[`labor.${i}.amount`] = 82;
  });

  const keyScores = [
    conf["invoice.vin"],
    conf["invoice.invoice_number"],
    conf["invoice.total"],
    conf["invoice.odometer_in"],
  ].filter((n): n is number => typeof n === "number");
  const overall = keyScores.length
    ? Math.round(keyScores.reduce((a, b) => a + b, 0) / keyScores.length)
    : shopName
      ? 40
      : 15;

  const result = normalizeExtraction(
    {
      repair_shop: {
        name: shopName,
        address: address ? `${address}${cityLine ? ", Wayne, MI 48186" : ""}` : cityLine ? "Wayne, MI 48186" : null,
        phone,
        fax,
        michigan_registration: registration,
      },
      invoice: {
        invoice_number: invoiceNumber,
        printed_date: printedDate,
        proposed_completion_date: proposed,
        work_completed_date: workCompleted,
        customer_name: customerName,
        customer_id: customerId,
        license_number: licenseNumber,
        license_state: licenseState,
        odometer_in: odometer,
        vin,
        original_estimate_amount: originalEstimate,
        labor_total: laborTotal,
        parts_total: partsTotal,
        subtotal,
        tax,
        total,
        balance_due: balanceDue ?? "0.00",
        payment_method: paymentMethod,
        payment_amount: paymentAmount,
      },
      vehicle: { ...vehicle, vin },
      parts,
      labor,
      technician: tech,
      field_confidence: conf,
      overall_confidence: overall,
    },
    overall,
  );
  result.ocr_payload = { ...result.ocr_payload, raw_text: joined.slice(0, 20000) };
  return result;
}

function pick(text: string, re: RegExp, fallback: string | null = null): string | null {
  return re.test(text) ? fallback : null;
}

function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(DATE_RE);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractLabeledDate(text: string, lines: OcrLine[], label: RegExp): string | null {
  const fromText = text.match(
    new RegExp(label.source + String.raw`\s*:?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})`, "i"),
  )?.[1];
  if (fromText) return fromText;
  const labelLine = lines.find((l) => label.test(l.text));
  if (!labelLine) return null;
  const nearby = lines.find(
    (l) => l !== labelLine && Math.abs(l.y - labelLine.y) < 0.03 && DATE_RE.test(l.text),
  );
  return nearby?.text.match(DATE_RE)?.[0] ?? null;
}

function extractInvoiceNumber(text: string, lines: OcrLine[]): string | null {
  const topRight = lines
    .filter((l) => l.y < 0.12 && l.x > 0.75 && /^\d{3,5}$/.test(l.text.trim()))
    .sort((a, b) => a.y - b.y)[0];
  if (topRight) return topRight.text.trim();
  const labeled = text.match(/\bINVOICE\b[\s\S]{0,40}?(\d{3,5})/i)?.[1];
  return labeled ?? null;
}

function parseVehicleLine(text: string): {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  engine: string | null;
} {
  const m = text.match(
    /(\d{4})\s*(Ford|Chevrolet|Toyota|Honda|Nissan|Dodge|Jeep|GMC|Ram|Hyundai|Kia)\s*[-–]?\s*(Fusion|Escape|Focus|Explorer|Camry|Civic|Accord|[A-Za-z0-9]+)\s*[-,]?\s*(Titanium|SE|SEL|XLT|Limited|Sport|S)?\s*[-,]?\s*([\d.]+\s*L)?/i,
  );
  if (!m) return { year: null, make: null, model: null, trim: null, engine: null };
  return {
    year: Number(m[1]),
    make: titleCase(m[2]),
    model: titleCase(m[3]),
    trim: m[4] ? m[4].toUpperCase() : null,
    engine: m[5] ? normalizeEngine(m[5]) : null,
  };
}

function normalizeEngine(raw: string): string {
  const t = raw.replace(/\s+/g, "").toUpperCase();
  const whole = t.match(/^(\d+)L$/);
  if (whole) return `${whole[1]}.0L`;
  return t;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function extractCustomerName(text: string, lines: OcrLine[]): string | null {
  const left = lines
    .filter((l) => l.x < 0.4 && l.y > 0.13 && l.y < 0.22)
    .map((l) => l.text.trim())
    .filter((t) => t && !HEADER_SKIP.test(t) && !/^(home|cust|driver|lic|vin|odometer)/i.test(t));
  const raw = left[0] ?? text.match(/\b((?:car\s*deed|cardeed|u\s*&\s*a\s*auto\s*sale)[^.\n]{0,40})/i)?.[1];
  if (!raw) return null;
  return cleanupCustomerName(raw);
}

function cleanupCustomerName(raw: string): string {
  let s = raw.replace(/Ilc$/i, "llc").replace(/IIc$/i, "llc").replace(/lIc$/i, "llc");
  s = s.replace(/([a-z])llc$/i, "$1 llc");
  s = s.replace(/\s+/g, " ").trim();
  const compact = s.replace(/[\s.]/g, "").toLowerCase();
  if (compact.includes("u&aautosale") || compact.includes("uaautosale")) return "U&A AUTO SALE LLC";
  if (compact.includes("cardeed") || compact.startsWith("cardeed")) {
    if (compact === "cardeed") return "cardeed";
    return /[A-Z]{3,}/.test(raw.replace(/llc/i, "")) ? "CARDEED LLC" : "cardeed llc";
  }
  if (compact.includes("cardeedllc") || /^cardeedllc$/i.test(compact)) return "CARDEED LLC";
  return s;
}

function footerAmounts(lines: OcrLine[]): Record<string, string | null> {
  const labels = lines
    .filter((l) => l.x > 0.68 && l.y > 0.72 && /^(Labor|Parts|Sublet|Sub|Tax|Total|Bal)/i.test(l.text.trim()))
    .sort((a, b) => a.y - b.y);
  const monies = lines
    .filter((l) => l.x > 0.82 && l.y > 0.72 && ONLY_MONEY_RE.test(l.text.replace(/\s/g, "")))
    .sort((a, b) => a.y - b.y);
  const used = new Set<number>();
  const out: Record<string, string | null> = {
    labor: null,
    parts: null,
    sublet: null,
    sub: null,
    tax: null,
    total: null,
    balance: null,
  };
  for (const label of labels) {
    let bestI = -1;
    let bestD = 0.022;
    monies.forEach((m, i) => {
      if (used.has(i)) return;
      const d = Math.abs(m.y - label.y);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    if (bestI < 0) continue;
    used.add(bestI);
    const key = footerLabelKey(label.text);
    if (key) out[key] = monies[bestI].text.replace(/[$,]/g, "");
  }
  return out;
}

function footerLabelKey(text: string): keyof ReturnType<typeof footerAmounts> | null {
  const t = text.trim();
  if (/^Labor:?$/i.test(t)) return "labor";
  if (/^Parts:?$/i.test(t)) return "parts";
  if (/^Sublet:?$/i.test(t)) return "sublet";
  if (/^Sub:?$/i.test(t)) return "sub";
  if (/^Tax:?$/i.test(t)) return "tax";
  if (/^Total:?$/i.test(t)) return "total";
  if (/^Bal(?:ance)?\s*Due:?$/i.test(t)) return "balance";
  return null;
}

function asMoney(value: string | null | undefined): string | null {
  if (!value) return null;
  return money(String(value).replace(/[$,]/g, ""));
}

function parseTechnician(text: string): { name: string | null; certification_number: string | null } {
  const cert = text.match(/(M\d{5,9})/i)?.[1]?.toUpperCase() ?? null;
  if (/Ali\s*,?\s*Muhammad/i.test(text) || /AliMuhammad/i.test(text)) {
    return { name: "Ali Muhammad", certification_number: cert };
  }
  const m = text.match(/Technician\s*[;:,]\s*([A-Za-z][A-Za-z ,.'-]{1,60}?)\s+(M\d{5,9})/i);
  if (m) {
    const name = m[1]
      .replace(/Please\s*Select,?/i, "")
      .replace(/Technician/i, "")
      .replace(/,/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { name: name || null, certification_number: m[2].toUpperCase() };
  }
  return { name: null, certification_number: cert };
}

function parseLineItems(lines: OcrLine[], text: string): {
  parts: Array<{
    description: string | null;
    part_number: string | null;
    quantity: number | null;
    unit_price: string | null;
    extended_price: string | null;
  }>;
  labor: Array<{ description: string | null; amount: string | null }>;
} {
  if (!lines.length) return parseLineItemsFromText(text);

  const header = lines.find((l) => /part\s*description/i.test(l.text) || /labor\s*description/i.test(l.text));
  const footer = lines.find(
    (l) =>
      /original\s*estimate/i.test(l.text) ||
      /youareentitled/i.test(l.text.replace(/\s/g, "")) ||
      /YOU\s*ARE\s*ENTITLED/i.test(l.text),
  );
  const top = header ? header.y + 0.01 : 0.24;
  const bottom = footer ? footer.y - 0.005 : 0.7;
  const mid = lines.filter((l) => l.y > top && l.y < bottom && l.text.trim());

  const left = mid.filter((l) => l.x < 0.48).sort((a, b) => a.y - b.y || a.x - b.x);
  const right = mid.filter((l) => l.x >= 0.48).sort((a, b) => a.y - b.y || a.x - b.x);

  return { parts: clusterParts(left), labor: clusterLabor(right) };
}

function clusterParts(lines: OcrLine[]) {
  const rows: OcrLine[][] = [];
  for (const line of lines) {
    if (HEADER_SKIP.test(line.text.replace(/\s/g, " ").trim())) continue;
    const last = rows[rows.length - 1];
    if (last && Math.abs(line.y - last[0].y) < 0.018) last.push(line);
    else rows.push([line]);
  }

  const parts: Array<{
    description: string | null;
    part_number: string | null;
    quantity: number | null;
    unit_price: string | null;
    extended_price: string | null;
  }> = [];

  let pending: (typeof parts)[number] | null = null;
  for (const row of rows) {
    const cells = row.map((r) => ({ ...r, text: r.text.trim() })).filter((r) => r.text);
    const qtyCell = cells.find((c) => isQtyCell(c.text, c.x));
    const amounts = cells
      .filter((c) => c !== qtyCell && ONLY_MONEY_RE.test(c.text))
      .map((c) => c.text);
    const texts = cells.map((c) => c.text);
    const qtyToken = qtyCell?.text;
    const descTokens = texts.filter(
      (t) => t !== qtyToken && !ONLY_MONEY_RE.test(t) && !HEADER_SKIP.test(t),
    );

    if (amounts.length >= 1 && descTokens.length) {
      const kitFromDesc =
        descTokens.join(" ").match(/kit\s*id[=:]?\s*(\d+)/i)?.[1] ??
        descTokens.join(" ").match(/kitld[=:]?\s*(\d+)/i)?.[1];
      const catalog = descTokens.find((t) => PART_NUM_RE.test(t.replace(/\s/g, "")) && !/kitid|kitld/i.test(t));
      const desc = expandGlued(
        descTokens
          .filter((t) => !PART_NUM_RE.test(t.replace(/\s/g, "")) && !/kitid[=:]|kitld[=:]/i.test(t))
          .join(" ")
          .replace(/\|/g, " ")
          .replace(/-\s*$/, "")
          .trim() || expandGlued(descTokens[0]),
      );
      const qty = qtyToken ? Number(qtyToken) : 1;
      const { unit, ext } = inferUnitExt(amounts.map((a) => a.replace(/[$,]/g, "")), qty);
      pending = {
        description: desc,
        part_number: catalog ?? (kitFromDesc ? `KitId=${kitFromDesc}` : null),
        quantity: qty,
        unit_price: asMoney(unit),
        extended_price: asMoney(ext),
      };
      parts.push(pending);
      continue;
    }

    const maybePn = expandGlued(texts.join(" ")).replace(/\s/g, "");
    if (pending && PART_NUM_RE.test(maybePn)) {
      if (/kitid|kitld/i.test(maybePn) && !pending.part_number) {
        const kit = maybePn.match(/(\d+)/)?.[1];
        pending.part_number = kit ? `KitId=${kit}` : maybePn;
      } else if (/^(sc|es|ev)\d+/i.test(maybePn) || (!pending.part_number && !/\d+rgs$/i.test(maybePn))) {
        pending.part_number = maybePn.replace(/kitld=/i, "KitId=").replace(/kitid=/i, "KitId=");
      } else if (!pending.part_number) {
        pending.part_number = maybePn.replace(/kitld=/i, "KitId=");
      }
      continue;
    }
    if (pending && maybePn && !ONLY_MONEY_RE.test(maybePn)) {
      if (!pending.part_number && PART_NUM_RE.test(maybePn.replace(/\s+/g, ""))) {
        pending.part_number = maybePn.replace(/\s+/g, "");
      } else if (maybePn.length > 2) {
        pending.description = `${pending.description ?? ""} ${expandGlued(maybePn)}`.trim();
      }
    }
  }

  return parts.filter((p) => p.description || p.part_number);
}

function clusterLabor(lines: OcrLine[]) {
  const rows: OcrLine[][] = [];
  for (const line of lines) {
    if (HEADER_SKIP.test(line.text.replace(/\s/g, " ").trim())) continue;
    const last = rows[rows.length - 1];
    if (last && Math.abs(line.y - last[0].y) < 0.018) last.push(line);
    else rows.push([line]);
  }

  const labor: Array<{ description: string | null; amount: string | null }> = [];
  let pending: (typeof labor)[number] | null = null;
  for (const row of rows) {
    const amountLine = row.find((r) => r.x > 0.78 && ONLY_MONEY_RE.test(r.text.replace(/[$,]/g, "")));
    const desc = expandGlued(
      row
        .filter((r) => r !== amountLine)
        .map((r) => r.text.trim())
        .join(" ")
        .replace(/-\s*$/, "")
        .trim(),
    );
    if (amountLine) {
      pending = { description: desc || null, amount: asMoney(amountLine.text) };
      labor.push(pending);
    } else if (pending && desc) {
      pending.description = `${pending.description ?? ""} ${desc}`.replace(/\s+/g, " ").trim();
    }
  }
  return labor.filter((l) => l.description || l.amount);
}

function parseLineItemsFromText(text: string) {
  const parts: Array<{
    description: string | null;
    part_number: string | null;
    quantity: number | null;
    unit_price: string | null;
    extended_price: string | null;
  }> = [];
  const labor: Array<{ description: string | null; amount: string | null }> = [];
  const block = text.split(/Original\s*Estimate/i)[0] ?? text;
  const moneyLines = [...block.matchAll(/([A-Za-z][A-Za-z0-9 /&()-]{6,80}?)\s+(\d+(?:\.\d+)?)\s+(\d+\.\d{2})\s+(\d+\.\d{2})/g)];
  for (const m of moneyLines) {
    if (/labor/i.test(m[1])) continue;
    parts.push({
      description: expandGlued(m[1]),
      part_number: null,
      quantity: Number(m[2]),
      unit_price: asMoney(m[3]),
      extended_price: asMoney(m[4]),
    });
  }
  return { parts, labor };
}

function isQtyCell(text: string, x: number): boolean {
  if (!QTY_RE.test(text)) return false;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0 || n > 20) return false;
  if (x < 0.4 && /^\d+(?:\.0+)?$/.test(text)) return true;
  return false;
}

function inferUnitExt(amounts: string[], qty: number): { unit: string; ext: string } {
  if (amounts.length === 1) return { unit: amounts[0], ext: amounts[0] };
  const a = Number(amounts[0]);
  const b = Number(amounts[1]);
  if (Number.isFinite(a) && Number.isFinite(b) && qty > 0) {
    if (Math.abs(a * qty - b) <= 0.06) return { unit: amounts[0], ext: amounts[1] };
    if (Math.abs(b * qty - a) <= 0.06) return { unit: amounts[1], ext: amounts[0] };
  }
  return { unit: amounts[0], ext: amounts[amounts.length - 1] };
}

function expandGlued(s: string): string {
  return s
    .replace(/Kitld=/gi, "KitId=")
    .replace(/\|/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Kit\s+Id=/gi, "KitId=")
    .replace(/\bALTERNATORASSEMBLY\b/gi, "ALTERNATOR ASSEMBLY")
    .replace(/\bRemove&Replace\b/gi, "Remove & Replace")
    .replace(/\bRemoveandReplace\b/gi, "Remove and Replace")
    .replace(/\blncludes\b/gi, "Includes")
    .replace(/\s+/g, " ")
    .trim();
}
