"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { categorizeRepair } from "@/lib/categorize";
import { mutateStore } from "@/lib/data/store";
import { detectMileageAnomaly } from "@/lib/mileage";
import { addMoney, money, parseMoneyInput } from "@/lib/money";
import { newId } from "@/lib/ids";
import { normalizeVin } from "@/lib/vin";
import type {
  DocumentRecord,
  FleetClient,
  Invoice,
  InvoiceLabor,
  InvoicePart,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Vehicle,
  VehicleStatus,
} from "@/types";

async function requireWriter() {
  const session = await getSession();
  if (!session || session.role === "viewer") {
    throw new Error("You do not have permission to make changes.");
  }
  return session;
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function saveClient(formData: FormData) {
  const session = await requireWriter();
  const id = String(formData.get("id") || newId());
  await mutateStore((store) => {
    const slug = String(formData.get("slug") || "").trim().toLowerCase() || null;
    if (slug) {
      const clash = store.clients.find((c) => c.slug === slug && c.id !== id);
      if (clash) throw new Error(`Client slug “${slug}” is already used.`);
    }
    const next: FleetClient = {
      id,
      name: String(formData.get("name") || "").trim(),
      legal_name: String(formData.get("legal_name") || "").trim() || null,
      slug,
      email: String(formData.get("email") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      website: String(formData.get("website") || "").trim() || null,
      address: String(formData.get("address") || "").trim() || null,
      city: String(formData.get("city") || "").trim() || null,
      state: String(formData.get("state") || "").trim() || null,
      zip: String(formData.get("zip") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      created_at: store.clients.find((c) => c.id === id)?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!next.name) throw new Error("Client name is required.");
    const prev = store.clients.find((c) => c.id === id);
    if (prev) store.clients = store.clients.map((c) => (c.id === id ? next : c));
    else store.clients.push(next);
    store.audit_logs.unshift({
      id: newId(),
      user_id: session.id || null,
      entity_type: "client",
      entity_id: id,
      action: prev ? "update" : "create",
      field_name: null,
      old_value: prev?.name ?? null,
      new_value: next.name,
      metadata: null,
      created_at: new Date().toISOString(),
    });
  });
  revalidateAll();
  return { id };
}

export type ImportVehicleRow = {
  fleet_id?: string | null;
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  engine?: string | null;
  license_plate?: string | null;
  state?: string | null;
  mileage?: number | null;
  color?: string | null;
  notes?: string | null;
};

export async function importClientVehicles(input: { client_id: string; vehicles: ImportVehicleRow[] }) {
  const session = await requireWriter();
  const clientId = input.client_id;
  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const now = new Date().toISOString();

  await mutateStore((store) => {
    const client = store.clients.find((c) => c.id === clientId);
    if (!client) throw new Error("Client not found.");

    for (const row of input.vehicles) {
      const vin = row.vin ? normalizeVin(row.vin) : null;
      const fleetId = row.fleet_id?.trim() || null;
      if (!vin && !fleetId && !row.license_plate && !row.make && !row.model) {
        result.skipped += 1;
        continue;
      }
      if (vin && vin.length !== 17) {
        result.errors.push(`VIN ${row.vin} is not 17 characters — skipped.`);
        result.skipped += 1;
        continue;
      }

      const byVin = vin ? store.vehicles.find((v) => v.vin === vin) : null;
      const byFleet =
        !byVin && fleetId
          ? store.vehicles.find((v) => v.vehicle_id === fleetId && (v.client_id ?? null) === clientId)
          : null;
      const existing = byVin ?? byFleet ?? null;

      if (existing) {
        if (existing.client_id && existing.client_id !== clientId) {
          result.errors.push(
            `VIN/fleet ${vin ?? fleetId} already belongs to another client — not moved.`,
          );
          result.skipped += 1;
          continue;
        }
        const next: Vehicle = {
          ...existing,
          client_id: clientId,
          vehicle_id: fleetId ?? existing.vehicle_id,
          vin: vin ?? existing.vin,
          year: row.year ?? existing.year,
          make: row.make?.trim() || existing.make,
          model: row.model?.trim() || existing.model,
          trim: row.trim?.trim() || existing.trim,
          engine: row.engine?.trim() || existing.engine,
          license_plate: row.license_plate?.trim() || existing.license_plate,
          state: row.state?.trim() || existing.state,
          current_mileage: row.mileage ?? existing.current_mileage,
          color: row.color?.trim() || existing.color,
          notes: row.notes?.trim() || existing.notes,
          updated_at: now,
        };
        store.vehicles = store.vehicles.map((v) => (v.id === existing.id ? next : v));
        result.updated += 1;
        continue;
      }

      if (fleetId) {
        const clash = store.vehicles.find((v) => v.vehicle_id === fleetId && (v.client_id ?? null) === clientId);
        if (clash) {
          result.errors.push(`Fleet ID ${fleetId} already exists on this client.`);
          result.skipped += 1;
          continue;
        }
      }

      store.vehicles.push({
        id: newId(),
        client_id: clientId,
        vehicle_id: fleetId,
        vin,
        year: row.year ?? null,
        make: row.make?.trim() || null,
        model: row.model?.trim() || null,
        trim: row.trim?.trim() || null,
        engine: row.engine?.trim() || null,
        body_style: null,
        license_plate: row.license_plate?.trim() || null,
        state: row.state?.trim() || "MI",
        current_mileage: row.mileage ?? null,
        purchase_date: null,
        purchase_price: null,
        acquisition_source: client.name,
        status: "available",
        color: row.color?.trim() || null,
        notes: row.notes?.trim() || null,
        rental_revenue_total: null,
        created_at: now,
        updated_at: now,
      });
      result.created += 1;
    }

    store.audit_logs.unshift({
      id: newId(),
      user_id: session.id || null,
      entity_type: "client",
      entity_id: clientId,
      action: "update",
      field_name: "vehicles",
      old_value: null,
      new_value: `imported +${result.created} ~${result.updated}`,
      metadata: { created: result.created, updated: result.updated, skipped: result.skipped, errors: result.errors },
      created_at: now,
    });
  });

  revalidateAll();
  return result;
}

export async function saveVehicle(formData: FormData) {
  const session = await requireWriter();
  const id = String(formData.get("id") || newId());
  const vinRaw = String(formData.get("vin") || "").trim();
  const vin = vinRaw ? normalizeVin(vinRaw) : null;
  const clientId = String(formData.get("client_id") || "").trim() || null;

  await mutateStore((store) => {
    if (vin) {
      const existing = store.vehicles.find((v) => v.vin === vin && v.id !== id);
      if (existing) throw new Error(`VIN already exists on ${existing.vehicle_id ?? existing.id}. Match that vehicle instead of creating a duplicate.`);
    }
    const fleetId = String(formData.get("vehicle_id") || "").trim() || null;
    if (fleetId) {
      const existing = store.vehicles.find(
        (v) => v.vehicle_id === fleetId && v.id !== id && (v.client_id ?? null) === clientId,
      );
      if (existing) throw new Error(`Fleet ID ${fleetId} is already mapped to another vehicle for this client.`);
    }

    const next: Vehicle = {
      id,
      client_id: clientId,
      vehicle_id: fleetId,
      vin,
      year: formData.get("year") ? Number(formData.get("year")) : null,
      make: String(formData.get("make") || "").trim() || null,
      model: String(formData.get("model") || "").trim() || null,
      trim: String(formData.get("trim") || "").trim() || null,
      engine: String(formData.get("engine") || "").trim() || null,
      body_style: String(formData.get("body_style") || "").trim() || null,
      license_plate: String(formData.get("license_plate") || "").trim() || null,
      state: String(formData.get("state") || "").trim() || null,
      current_mileage: formData.get("current_mileage") ? Number(formData.get("current_mileage")) : null,
      purchase_date: String(formData.get("purchase_date") || "") || null,
      purchase_price: parseMoneyInput(String(formData.get("purchase_price") || "")),
      acquisition_source: String(formData.get("acquisition_source") || "").trim() || null,
      status: (String(formData.get("status") || "available") as VehicleStatus) || "available",
      color: String(formData.get("color") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      rental_revenue_total: parseMoneyInput(String(formData.get("rental_revenue_total") || "")),
      created_at: store.vehicles.find((v) => v.id === id)?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const prev = store.vehicles.find((v) => v.id === id);
    if (prev) {
      store.vehicles = store.vehicles.map((v) => (v.id === id ? next : v));
      if (prev.current_mileage !== next.current_mileage) {
        store.audit_logs.unshift({
          id: newId(),
          user_id: session.id || null,
          entity_type: "vehicle",
          entity_id: id,
          action: "update",
          field_name: "current_mileage",
          old_value: prev.current_mileage?.toString() ?? null,
          new_value: next.current_mileage?.toString() ?? null,
          metadata: null,
          created_at: new Date().toISOString(),
        });
      }
    } else {
      store.vehicles.push(next);
      store.audit_logs.unshift({
        id: newId(),
        user_id: session.id || null,
        entity_type: "vehicle",
        entity_id: id,
        action: "create",
        field_name: null,
        old_value: null,
        new_value: next.vin,
        metadata: null,
        created_at: new Date().toISOString(),
      });
    }
  });

  revalidateAll();
  return { id };
}

export async function saveShop(formData: FormData) {
  await requireWriter();
  const id = String(formData.get("id") || newId());
  await mutateStore((store) => {
    const next = {
      id,
      name: String(formData.get("name") || "").trim(),
      address: String(formData.get("address") || "").trim() || null,
      city: String(formData.get("city") || "").trim() || null,
      state: String(formData.get("state") || "").trim() || null,
      zip: String(formData.get("zip") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      fax: String(formData.get("fax") || "").trim() || null,
      registration_number: String(formData.get("registration_number") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      created_at: store.repair_shops.find((s) => s.id === id)?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!next.name) throw new Error("Shop name is required.");
    const idx = store.repair_shops.findIndex((s) => s.id === id);
    if (idx >= 0) store.repair_shops[idx] = next;
    else store.repair_shops.push(next);
  });
  revalidateAll();
  return { id };
}

export type InvoiceDraftPart = {
  description: string;
  part_number?: string | null;
  manufacturer_part_number?: string | null;
  quantity?: string | null;
  unit_price?: string | null;
  extended_price?: string | null;
  notes?: string | null;
};

export type InvoiceDraftLabor = {
  description: string;
  amount?: string | null;
  notes?: string | null;
};

export type InvoiceDraftPayment = {
  payment_date?: string | null;
  amount: string;
  payment_method?: PaymentMethod | null;
  reference_number?: string | null;
  notes?: string | null;
};

export interface SaveInvoiceInput {
  id?: string;
  invoice_number?: string | null;
  vehicle_id?: string | null;
  repair_shop_id?: string | null;
  invoice_date?: string | null;
  printed_date?: string | null;
  proposed_completion_date?: string | null;
  work_completed_date?: string | null;
  customer_name?: string | null;
  customer_id?: string | null;
  license_number?: string | null;
  license_state?: string | null;
  odometer_in?: number | null;
  technician_name?: string | null;
  technician_certification_number?: string | null;
  labor_total?: string | null;
  parts_total?: string | null;
  subtotal?: string | null;
  tax?: string | null;
  invoice_total?: string | null;
  balance_due?: string | null;
  payment_status?: PaymentStatus;
  payment_method?: PaymentMethod | null;
  original_estimate_amount?: string | null;
  notes?: string | null;
  ocr_status?: Invoice["ocr_status"];
  ocr_confidence?: number | null;
  ocr_payload?: Invoice["ocr_payload"];
  manually_verified?: boolean;
  parts: InvoiceDraftPart[];
  labor: InvoiceDraftLabor[];
  payments: InvoiceDraftPayment[];
  document?: {
    file_name: string;
    file_path: string;
    file_type?: string | null;
    file_size?: number | null;
    document_type?: DocumentRecord["document_type"];
    ocr_processed?: boolean;
    ocr_confidence?: number | null;
  } | null;
}

export async function saveInvoice(input: SaveInvoiceInput) {
  const session = await requireWriter();
  const id = input.id || newId();

  await mutateStore((store) => {
    const prev = store.invoices.find((i) => i.id === id);
    const partsTotal =
      money(input.parts_total) ??
      addMoney(...input.parts.map((p) => p.extended_price));
    const laborTotal =
      money(input.labor_total) ??
      addMoney(...input.labor.map((l) => l.amount));
    const tax = money(input.tax) ?? "0.00";
    const calculated = addMoney(partsTotal, laborTotal, tax);
    const invoiceTotal = money(input.invoice_total);
    const paid = addMoney(...input.payments.map((p) => p.amount));
    const balance = money(input.balance_due);
    let paymentStatus: PaymentStatus = input.payment_status ?? "unpaid";
    if (!input.payment_status) {
      if (Number(paid) <= 0) paymentStatus = "unpaid";
      else if (balance && Number(balance) > 0) paymentStatus = "partially_paid";
      else paymentStatus = "paid";
    }

    const next: Invoice = {
      id,
      invoice_number: input.invoice_number?.trim() || null,
      vehicle_id: input.vehicle_id || null,
      repair_shop_id: input.repair_shop_id || null,
      invoice_date: input.invoice_date || null,
      printed_date: input.printed_date || null,
      proposed_completion_date: input.proposed_completion_date || null,
      work_completed_date: input.work_completed_date || null,
      customer_name: input.customer_name?.trim() || null,
      customer_id: input.customer_id?.trim() || null,
      license_number: input.license_number?.trim() || null,
      license_state: input.license_state?.trim() || null,
      odometer_in: input.odometer_in ?? null,
      technician_name: input.technician_name?.trim() || null,
      technician_certification_number: input.technician_certification_number?.trim() || null,
      labor_total: laborTotal,
      parts_total: partsTotal,
      subtotal: money(input.subtotal) ?? addMoney(partsTotal, laborTotal),
      tax,
      invoice_total: invoiceTotal,
      calculated_total: calculated,
      balance_due: balance ?? (invoiceTotal ? addMoney(invoiceTotal, `-${paid}`) : addMoney(calculated, `-${paid}`)),
      payment_status: paymentStatus,
      payment_method: input.payment_method ?? input.payments[0]?.payment_method ?? null,
      original_estimate_amount: money(input.original_estimate_amount),
      notes: input.notes?.trim() || null,
      source_document_id: prev?.source_document_id ?? null,
      ocr_status: input.ocr_status ?? prev?.ocr_status ?? "not_processed",
      ocr_confidence: input.ocr_confidence ?? prev?.ocr_confidence ?? null,
      ocr_payload: input.ocr_payload ?? prev?.ocr_payload ?? null,
      manually_verified: input.manually_verified ?? true,
      verified_by: input.manually_verified ? session.id || null : (prev?.verified_by ?? null),
      verified_at: input.manually_verified ? new Date().toISOString() : (prev?.verified_at ?? null),
      created_by: prev?.created_by ?? (session.id || null),
      created_at: prev?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (prev) {
      const fields: Array<keyof Invoice> = [
        "odometer_in",
        "invoice_total",
        "invoice_number",
        "vehicle_id",
        "tax",
        "payment_status",
      ];
      for (const field of fields) {
        const oldVal = prev[field];
        const newVal = next[field];
        if (String(oldVal ?? "") !== String(newVal ?? "")) {
          store.audit_logs.unshift({
            id: newId(),
            user_id: session.id || null,
            entity_type: "invoice",
            entity_id: id,
            action: "update",
            field_name: field,
            old_value: oldVal == null ? null : String(oldVal),
            new_value: newVal == null ? null : String(newVal),
            metadata: null,
            created_at: new Date().toISOString(),
          });
        }
      }
      store.invoices = store.invoices.map((i) => (i.id === id ? next : i));
    } else {
      store.invoices.push(next);
      store.audit_logs.unshift({
        id: newId(),
        user_id: session.id || null,
        entity_type: "invoice",
        entity_id: id,
        action: "create",
        field_name: null,
        old_value: null,
        new_value: next.invoice_number,
        metadata: null,
        created_at: new Date().toISOString(),
      });
    }

    store.invoice_parts = store.invoice_parts.filter((p) => p.invoice_id !== id);
    store.invoice_labor = store.invoice_labor.filter((l) => l.invoice_id !== id);
    store.payments = store.payments.filter((p) => p.invoice_id !== id);

    const now = new Date().toISOString();
    const parts: InvoicePart[] = input.parts
      .filter((p) => p.description.trim())
      .map((p) => ({
        id: newId(),
        invoice_id: id,
        part_description: p.description.trim(),
        part_number: p.part_number?.trim() || null,
        manufacturer_part_number: p.manufacturer_part_number?.trim() || null,
        quantity: p.quantity?.toString() || null,
        unit_price: money(p.unit_price),
        extended_price: money(p.extended_price) ?? money(p.unit_price),
        category: categorizeRepair(p.description),
        side: null,
        position: null,
        notes: p.notes?.trim() || null,
        created_at: now,
      }));
    const labor: InvoiceLabor[] = input.labor
      .filter((l) => l.description.trim())
      .map((l) => ({
        id: newId(),
        invoice_id: id,
        labor_description: l.description.trim(),
        labor_category: categorizeRepair(l.description),
        extended_amount: money(l.amount),
        technician: null,
        notes: l.notes?.trim() || null,
        created_at: now,
      }));
    const payments: Payment[] = input.payments
      .filter((p) => p.amount)
      .map((p) => ({
        id: newId(),
        invoice_id: id,
        payment_date: p.payment_date || next.work_completed_date || next.invoice_date,
        amount: money(p.amount) ?? "0.00",
        payment_method: p.payment_method ?? next.payment_method,
        reference_number: p.reference_number?.trim() || null,
        notes: p.notes?.trim() || null,
        created_at: now,
      }));

    store.invoice_parts.push(...parts);
    store.invoice_labor.push(...labor);
    store.payments.push(...payments);

    if (input.document) {
      const docId = newId();
      const doc: DocumentRecord = {
        id: docId,
        invoice_id: id,
        vehicle_id: next.vehicle_id,
        file_name: input.document.file_name,
        file_path: input.document.file_path,
        file_type: input.document.file_type ?? null,
        file_size: input.document.file_size ?? null,
        uploaded_at: now,
        uploaded_by: session.id || null,
        document_type: input.document.document_type ?? "invoice",
        ocr_processed: input.document.ocr_processed ?? false,
        ocr_confidence: input.document.ocr_confidence ?? null,
      };
      store.documents.push(doc);
      const inv = store.invoices.find((i) => i.id === id)!;
      inv.source_document_id = inv.source_document_id ?? docId;
    }

    store.mileage_history = store.mileage_history.filter((m) => m.invoice_id !== id);
    if (next.vehicle_id && next.odometer_in != null) {
      const recordedAt = next.work_completed_date ?? next.invoice_date ?? next.printed_date;
      if (recordedAt) {
        const others = store.mileage_history.filter((m) => m.vehicle_id === next.vehicle_id);
        const anomaly = detectMileageAnomaly(others, {
          recorded_at: recordedAt,
          mileage: next.odometer_in,
        });
        store.mileage_history.push({
          id: newId(),
          vehicle_id: next.vehicle_id,
          invoice_id: id,
          recorded_at: recordedAt,
          mileage: next.odometer_in,
          source: "invoice",
          anomaly: anomaly.anomaly,
          anomaly_note: anomaly.note,
          notes: null,
          created_at: now,
        });
        const vehicle = store.vehicles.find((v) => v.id === next.vehicle_id);
        if (vehicle) {
          const miles = store.mileage_history
            .filter((m) => m.vehicle_id === vehicle.id)
            .map((m) => m.mileage);
          if (miles.length) vehicle.current_mileage = Math.max(...miles);
          vehicle.updated_at = now;
        }
      }
    }
  });

  revalidateAll();
  return { id };
}

export async function createVehicleFromVin(input: {
  vin: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  engine?: string | null;
  fleetId?: string | null;
  mileage?: number | null;
  clientId?: string | null;
  customerName?: string | null;
}) {
  await requireWriter();
  const vin = normalizeVin(input.vin);
  if (!vin) throw new Error("VIN is required to create a vehicle.");
  let id = "";
  await mutateStore((store) => {
    const existing = store.vehicles.find((v) => v.vin === vin);
    if (existing) {
      id = existing.id;
      return;
    }
    id = newId();
    const clientId =
      input.clientId ||
      (input.customerName && /cardeed/i.test(input.customerName)
        ? store.clients.find((c) => /cardeed/i.test(c.name))?.id
        : null) ||
      store.clients.find((c) => c.slug === "cardeed")?.id ||
      store.clients[0]?.id ||
      null;
    store.vehicles.push({
      id,
      client_id: clientId ?? null,
      vehicle_id: input.fleetId?.trim() || null,
      vin,
      year: input.year ?? null,
      make: input.make ?? null,
      model: input.model ?? null,
      trim: input.trim ?? null,
      engine: input.engine ?? null,
      body_style: null,
      license_plate: null,
      state: null,
      current_mileage: input.mileage ?? null,
      purchase_date: null,
      purchase_price: null,
      acquisition_source: null,
      status: "available",
      color: null,
      notes: null,
      rental_revenue_total: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });
  revalidateAll();
  return { id };
}

export async function resetDemoData() {
  const session = await requireWriter();
  if (session.role !== "admin") throw new Error("Only admins can reset demo data.");
  const { resetStore } = await import("@/lib/data/store");
  await resetStore();
  revalidateAll();
}

export async function saveWarranty(formData: FormData) {
  const session = await requireWriter();
  const id = String(formData.get("id") || newId());
  const vehicleId = String(formData.get("vehicle_id") || "");
  if (!vehicleId) throw new Error("Vehicle is required.");
  const now = new Date().toISOString();

  await mutateStore((store) => {
    const prev = store.warranty_records.find((w) => w.id === id);
    const next = {
      id,
      vehicle_id: vehicleId,
      invoice_id: String(formData.get("invoice_id") || "") || null,
      invoice_part_id: String(formData.get("invoice_part_id") || "") || null,
      invoice_labor_id: String(formData.get("invoice_labor_id") || "") || null,
      component: String(formData.get("component") || "").trim() || null,
      category: String(formData.get("category") || "").trim() || null,
      warranty_available: formData.get("warranty_available") !== "false",
      warranty_provider: String(formData.get("warranty_provider") || "").trim() || null,
      warranty_start_date: String(formData.get("warranty_start_date") || "") || null,
      warranty_end_date: String(formData.get("warranty_end_date") || "") || null,
      warranty_mileage_limit: formData.get("warranty_mileage_limit")
        ? Number(formData.get("warranty_mileage_limit"))
        : null,
      warranty_notes: String(formData.get("warranty_notes") || "").trim() || null,
      created_at: prev?.created_at ?? now,
      updated_at: now,
    };
    if (prev) store.warranty_records = store.warranty_records.map((w) => (w.id === id ? next : w));
    else store.warranty_records.push(next);
    store.audit_logs.unshift({
      id: newId(),
      user_id: session.id || null,
      entity_type: "warranty",
      entity_id: id,
      action: prev ? "update" : "create",
      field_name: "component",
      old_value: prev?.component ?? null,
      new_value: next.component,
      metadata: { vehicle_id: vehicleId },
      created_at: now,
    });
  });
  revalidateAll();
  return { id };
}

export async function deleteWarranty(id: string) {
  const session = await requireWriter();
  await mutateStore((store) => {
    const prev = store.warranty_records.find((w) => w.id === id);
    store.warranty_records = store.warranty_records.filter((w) => w.id !== id);
    store.audit_logs.unshift({
      id: newId(),
      user_id: session.id || null,
      entity_type: "warranty",
      entity_id: id,
      action: "delete",
      field_name: null,
      old_value: prev?.component ?? null,
      new_value: null,
      metadata: null,
      created_at: new Date().toISOString(),
    });
  });
  revalidateAll();
}

export async function saveMaintenance(formData: FormData) {
  const session = await requireWriter();
  const id = String(formData.get("id") || newId());
  const vehicleId = String(formData.get("vehicle_id") || "");
  if (!vehicleId) throw new Error("Vehicle is required.");
  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title is required.");
  const now = new Date().toISOString();
  const completedAt = String(formData.get("completed_at") || "") || null;

  await mutateStore((store) => {
    const prev = store.maintenance_records.find((m) => m.id === id);
    const next = {
      id,
      vehicle_id: vehicleId,
      invoice_id: String(formData.get("invoice_id") || "") || null,
      category: String(formData.get("category") || "").trim() || null,
      title,
      description: String(formData.get("description") || "").trim() || null,
      due_date: String(formData.get("due_date") || "") || null,
      due_mileage: formData.get("due_mileage") ? Number(formData.get("due_mileage")) : null,
      completed_at: completedAt,
      completed_mileage: formData.get("completed_mileage") ? Number(formData.get("completed_mileage")) : null,
      status: completedAt ? "completed" : String(formData.get("status") || "scheduled"),
      notes: String(formData.get("notes") || "").trim() || null,
      created_at: prev?.created_at ?? now,
      updated_at: now,
    };
    if (prev) store.maintenance_records = store.maintenance_records.map((m) => (m.id === id ? next : m));
    else store.maintenance_records.push(next);
    store.audit_logs.unshift({
      id: newId(),
      user_id: session.id || null,
      entity_type: "maintenance",
      entity_id: id,
      action: prev ? "update" : "create",
      field_name: "title",
      old_value: prev?.title ?? null,
      new_value: next.title,
      metadata: { vehicle_id: vehicleId },
      created_at: now,
    });
  });
  revalidateAll();
  return { id };
}

export async function completeMaintenance(id: string) {
  const session = await requireWriter();
  const now = new Date().toISOString();
  await mutateStore((store) => {
    const rec = store.maintenance_records.find((m) => m.id === id);
    if (!rec) throw new Error("Maintenance record not found.");
    const vehicle = store.vehicles.find((v) => v.id === rec.vehicle_id);
    rec.status = "completed";
    rec.completed_at = now.slice(0, 10);
    rec.completed_mileage = vehicle?.current_mileage ?? rec.completed_mileage;
    rec.updated_at = now;
    store.audit_logs.unshift({
      id: newId(),
      user_id: session.id || null,
      entity_type: "maintenance",
      entity_id: id,
      action: "update",
      field_name: "status",
      old_value: "scheduled",
      new_value: "completed",
      metadata: null,
      created_at: now,
    });
  });
  revalidateAll();
}

export async function deleteMaintenance(id: string) {
  const session = await requireWriter();
  await mutateStore((store) => {
    store.maintenance_records = store.maintenance_records.filter((m) => m.id !== id);
    store.audit_logs.unshift({
      id: newId(),
      user_id: session.id || null,
      entity_type: "maintenance",
      entity_id: id,
      action: "delete",
      field_name: null,
      old_value: null,
      new_value: null,
      metadata: null,
      created_at: new Date().toISOString(),
    });
  });
  revalidateAll();
}
