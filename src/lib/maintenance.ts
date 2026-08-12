import type { MaintenanceRecord, Vehicle } from "@/types";

export type MaintenanceUiStatus = "scheduled" | "due" | "overdue" | "completed";

const DUE_SOON_DAYS = 14;
const DUE_SOON_MILES = 500;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(date: string, today = todayISO()) {
  return Math.round((new Date(date).getTime() - new Date(today).getTime()) / 86_400_000);
}

export function resolveMaintenanceStatus(
  record: MaintenanceRecord,
  vehicle: Vehicle | null | undefined,
  today = todayISO(),
): MaintenanceUiStatus {
  if (record.status === "completed" || record.completed_at) return "completed";

  const mile = vehicle?.current_mileage ?? null;
  const overdueByDate = record.due_date ? record.due_date < today : false;
  const overdueByMile =
    record.due_mileage != null && mile != null ? mile >= record.due_mileage : false;
  if (overdueByDate || overdueByMile) return "overdue";

  const dueSoonByDate = record.due_date ? daysUntil(record.due_date, today) <= DUE_SOON_DAYS : false;
  const dueSoonByMile =
    record.due_mileage != null && mile != null ? record.due_mileage - mile <= DUE_SOON_MILES : false;
  if (dueSoonByDate || dueSoonByMile) return "due";

  return "scheduled";
}

export function maintenanceStatusLabel(status: MaintenanceUiStatus) {
  switch (status) {
    case "completed":
      return "Completed";
    case "overdue":
      return "Overdue";
    case "due":
      return "Due soon";
    default:
      return "Scheduled";
  }
}
