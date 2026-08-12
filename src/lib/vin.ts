/** Normalize and validate VIN. Never silently invent a VIN. */

/**
 * Clean a VIN for matching/storage.
 * I/O/Q are not used in real VINs — OCR often misreads 1/0 as those letters.
 */
export function normalizeVin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/I/g, "1")
    .replace(/O/g, "0")
    .replace(/Q/g, "0");
  return cleaned || null;
}

export function isValidVin(vin: string | null | undefined): boolean {
  if (!vin) return false;
  const n = normalizeVin(vin);
  if (!n || n.length !== 17) return false;
  // I, O, Q are not used in VINs (already stripped by normalizeVin)
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(n);
}

export function vinValidationError(raw: string | null | undefined): string | null {
  const n = normalizeVin(raw);
  if (!n) return "VIN is required.";
  if (n.length !== 17) {
    return `VIN must be exactly 17 characters (got ${n.length}: ${n}). Fix the VIN field, then save again.`;
  }
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(n)) {
    return `VIN “${n}” has invalid characters. VINs cannot contain I, O, or Q.`;
  }
  return null;
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
