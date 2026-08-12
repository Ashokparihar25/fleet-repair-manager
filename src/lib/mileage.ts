import type { MileageHistory } from "@/types";

export function detectMileageAnomaly(
  vehicleHistory: MileageHistory[],
  next: { recorded_at: string; mileage: number },
): { anomaly: boolean; note: string | null } {
  const prior = vehicleHistory
    .filter((h) => h.recorded_at < next.recorded_at)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];

  if (prior && next.mileage < prior.mileage) {
    return {
      anomaly: true,
      note: `MILEAGE ANOMALY — later invoice has lower mileage (${next.mileage.toLocaleString()} after ${prior.mileage.toLocaleString()} on ${prior.recorded_at}).`,
    };
  }

  const later = vehicleHistory
    .filter((h) => h.recorded_at > next.recorded_at)
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))[0];

  if (later && later.mileage < next.mileage) {
    return {
      anomaly: true,
      note: `MILEAGE ANOMALY — later invoice has lower mileage (${later.mileage.toLocaleString()} on ${later.recorded_at} after ${next.mileage.toLocaleString()}).`,
    };
  }

  return { anomaly: false, note: null };
}

export function flagMileageAnomalies(history: MileageHistory[]): MileageHistory[] {
  const byVehicle = new Map<string, MileageHistory[]>();
  for (const h of history) {
    const list = byVehicle.get(h.vehicle_id) ?? [];
    list.push(h);
    byVehicle.set(h.vehicle_id, list);
  }

  return history.map((h) => {
    const others = (byVehicle.get(h.vehicle_id) ?? []).filter((x) => x.id !== h.id);
    const result = detectMileageAnomaly(others, {
      recorded_at: h.recorded_at,
      mileage: h.mileage,
    });
    return {
      ...h,
      anomaly: result.anomaly,
      anomaly_note: result.note,
    };
  });
}
