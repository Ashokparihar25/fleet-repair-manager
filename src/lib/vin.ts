/** Normalize and validate VIN. Never silently invent a VIN. */

export function normalizeVin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned || null;
}

export function isValidVin(vin: string | null | undefined): boolean {
  if (!vin) return false;
  const n = normalizeVin(vin);
  if (!n || n.length !== 17) return false;
  // I, O, Q are not used in VINs
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(n);
}

export function vinSourceAndNormalized(raw: string | null | undefined): {
  source_value: string | null;
  normalized_value: string | null;
} {
  return {
    source_value: raw?.trim() || null,
    normalized_value: normalizeVin(raw),
  };
}
