import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${m}/${d}/${y}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "FR";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function paymentStatusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Paid";
    case "partially_paid":
      return "Partially Paid";
    case "unpaid":
      return "Unpaid";
    case "voided":
      return "Voided";
    default:
      return status;
  }
}

export function paymentMethodLabel(method: string | null | undefined) {
  if (!method) return "—";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

export function vehicleStatusLabel(status: string) {
  switch (status) {
    case "available":
      return "Available";
    case "in_shop":
      return "In Shop";
    case "out_of_service":
      return "Out of Service";
    case "sold":
      return "Sold";
    case "pending_inspection":
      return "Pending Inspection";
    default:
      return status;
  }
}
