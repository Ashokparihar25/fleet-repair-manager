import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { money } from "@/lib/money";
import { flagMileageAnomalies } from "@/lib/mileage";
import { createSeedStore } from "@/lib/data/seed";
import { normalizeStore } from "@/lib/data/store-normalize";
import type {
  AuditLog,
  DocumentRecord,
  FleetClient,
  FleetStore,
  Invoice,
  InvoiceLabor,
  InvoicePart,
  MaintenanceRecord,
  MileageHistory,
  Payment,
  Profile,
  RepairCategory,
  RepairShop,
  Vehicle,
  WarrantyRecord,
} from "@/types";

const PAGE = 1000;

type Row = Record<string, unknown> & { id: string };

function throwIfError(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function asStr(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function asNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asBool(v: unknown, fallback = false): boolean {
  if (v == null) return fallback;
  return Boolean(v);
}

function asDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function asIso(v: unknown): string {
  if (v == null || v === "") return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function asMoney(v: unknown): string | null {
  return money(v as string | number | null | undefined);
}

async function fetchAll<T>(
  client: SupabaseClient,
  table: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select("*").range(from, from + PAGE - 1);
    throwIfError(error, `Failed to load ${table}`);
    const chunk = (data ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

function mapProfile(r: Row): Profile {
  return {
    id: r.id,
    full_name: asStr(r.full_name),
    email: asStr(r.email),
    role: (asStr(r.role) as Profile["role"]) || "viewer",
    created_at: asIso(r.created_at),
    updated_at: asIso(r.updated_at),
  };
}

function mapCategory(r: Row): RepairCategory {
  return {
    id: r.id,
    slug: String(r.slug ?? ""),
    name: String(r.name ?? ""),
    description: asStr(r.description),
    keywords: Array.isArray(r.keywords) ? (r.keywords as string[]) : [],
    created_at: asIso(r.created_at),
    updated_at: asIso(r.updated_at),
  };
}

function mapClient(r: Row): FleetClient {
  return {
    id: r.id,
    name: String(r.name ?? ""),
    legal_name: asStr(r.legal_name),
    slug: asStr(r.slug),
    email: asStr(r.email),
    phone: asStr(r.phone),
    website: asStr(r.website),
    address: asStr(r.address),
    city: asStr(r.city),
    state: asStr(r.state),
    zip: asStr(r.zip),
    notes: asStr(r.notes),
    created_at: asIso(r.created_at),
    updated_at: asIso(r.updated_at),
  };
}

function mapVehicle(r: Row): Vehicle {
  return {
    id: r.id,
    client_id: asStr(r.client_id),
    vehicle_id: asStr(r.vehicle_id),
    vin: asStr(r.vin),
    year: asNum(r.year),
    make: asStr(r.make),
    model: asStr(r.model),
    trim: asStr(r.trim),
    engine: asStr(r.engine),
    body_style: asStr(r.body_style),
    license_plate: asStr(r.license_plate),
    state: asStr(r.state),
    current_mileage: asNum(r.current_mileage),
    purchase_date: asDate(r.purchase_date),
    purchase_price: asMoney(r.purchase_price),
    acquisition_source: asStr(r.acquisition_source),
    status: (asStr(r.status) as Vehicle["status"]) || "available",
    color: asStr(r.color),
    notes: asStr(r.notes),
    rental_revenue_total: asMoney(r.rental_revenue_total),
    created_at: asIso(r.created_at),
    updated_at: asIso(r.updated_at),
  };
}

function mapShop(r: Row): RepairShop {
  return {
    id: r.id,
    name: String(r.name ?? ""),
    address: asStr(r.address),
    city: asStr(r.city),
    state: asStr(r.state),
    zip: asStr(r.zip),
    phone: asStr(r.phone),
    fax: asStr(r.fax),
    registration_number: asStr(r.registration_number),
    notes: asStr(r.notes),
    created_at: asIso(r.created_at),
    updated_at: asIso(r.updated_at),
  };
}

function mapInvoice(r: Row): Invoice {
  return {
    id: r.id,
    invoice_number: asStr(r.invoice_number),
    vehicle_id: asStr(r.vehicle_id),
    repair_shop_id: asStr(r.repair_shop_id),
    invoice_date: asDate(r.invoice_date),
    printed_date: asDate(r.printed_date),
    proposed_completion_date: asDate(r.proposed_completion_date),
    work_completed_date: asDate(r.work_completed_date),
    customer_name: asStr(r.customer_name),
    customer_id: asStr(r.customer_id),
    license_number: asStr(r.license_number),
    license_state: asStr(r.license_state),
    odometer_in: asNum(r.odometer_in),
    technician_name: asStr(r.technician_name),
    technician_certification_number: asStr(r.technician_certification_number),
    labor_total: asMoney(r.labor_total),
    parts_total: asMoney(r.parts_total),
    subtotal: asMoney(r.subtotal),
    tax: asMoney(r.tax),
    invoice_total: asMoney(r.invoice_total),
    calculated_total: asMoney(r.calculated_total),
    balance_due: asMoney(r.balance_due),
    payment_status: (asStr(r.payment_status) as Invoice["payment_status"]) || "unpaid",
    payment_method: (asStr(r.payment_method) as Invoice["payment_method"]) ?? null,
    original_estimate_amount: asMoney(r.original_estimate_amount),
    notes: asStr(r.notes),
    source_document_id: asStr(r.source_document_id),
    ocr_status: (asStr(r.ocr_status) as Invoice["ocr_status"]) || "not_processed",
    ocr_confidence: asNum(r.ocr_confidence),
    ocr_payload: (r.ocr_payload as Invoice["ocr_payload"]) ?? null,
    manually_verified: asBool(r.manually_verified),
    verified_by: asStr(r.verified_by),
    verified_at: r.verified_at ? asIso(r.verified_at) : null,
    created_by: asStr(r.created_by),
    created_at: asIso(r.created_at),
    updated_at: asIso(r.updated_at),
  };
}

function mapPart(r: Row): InvoicePart {
  return {
    id: r.id,
    invoice_id: String(r.invoice_id ?? ""),
    part_description: String(r.part_description ?? ""),
    part_number: asStr(r.part_number),
    manufacturer_part_number: asStr(r.manufacturer_part_number),
    quantity: asStr(r.quantity),
    unit_price: asMoney(r.unit_price),
    extended_price: asMoney(r.extended_price),
    category: asStr(r.category),
    side: asStr(r.side),
    position: asStr(r.position),
    notes: asStr(r.notes),
    created_at: asIso(r.created_at),
  };
}

function mapLabor(r: Row): InvoiceLabor {
  return {
    id: r.id,
    invoice_id: String(r.invoice_id ?? ""),
    labor_description: String(r.labor_description ?? ""),
    labor_category: asStr(r.labor_category),
    extended_amount: asMoney(r.extended_amount),
    technician: asStr(r.technician),
    notes: asStr(r.notes),
    created_at: asIso(r.created_at),
  };
}

function mapPayment(r: Row): Payment {
  return {
    id: r.id,
    invoice_id: String(r.invoice_id ?? ""),
    payment_date: asDate(r.payment_date),
    amount: asMoney(r.amount) ?? "0.00",
    payment_method: (asStr(r.payment_method) as Payment["payment_method"]) ?? null,
    reference_number: asStr(r.reference_number),
    notes: asStr(r.notes),
    created_at: asIso(r.created_at),
  };
}

function mapDocument(r: Row): DocumentRecord {
  return {
    id: r.id,
    invoice_id: asStr(r.invoice_id),
    vehicle_id: asStr(r.vehicle_id),
    file_name: String(r.file_name ?? ""),
    file_path: String(r.file_path ?? ""),
    file_type: asStr(r.file_type),
    file_size: asNum(r.file_size),
    uploaded_at: asIso(r.uploaded_at),
    uploaded_by: asStr(r.uploaded_by),
    document_type: (asStr(r.document_type) as DocumentRecord["document_type"]) || "invoice",
    ocr_processed: asBool(r.ocr_processed),
    ocr_confidence: asNum(r.ocr_confidence),
  };
}

function mapMileage(r: Row): MileageHistory {
  return {
    id: r.id,
    vehicle_id: String(r.vehicle_id ?? ""),
    invoice_id: asStr(r.invoice_id),
    recorded_at: asDate(r.recorded_at) ?? asIso(r.recorded_at).slice(0, 10),
    mileage: asNum(r.mileage) ?? 0,
    source: String(r.source ?? "invoice"),
    anomaly: asBool(r.anomaly),
    anomaly_note: asStr(r.anomaly_note),
    notes: asStr(r.notes),
    created_at: asIso(r.created_at),
  };
}

function mapMaintenance(r: Row): MaintenanceRecord {
  return {
    id: r.id,
    vehicle_id: String(r.vehicle_id ?? ""),
    invoice_id: asStr(r.invoice_id),
    category: asStr(r.category),
    title: String(r.title ?? ""),
    description: asStr(r.description),
    due_date: asDate(r.due_date),
    due_mileage: asNum(r.due_mileage),
    completed_at: asDate(r.completed_at),
    completed_mileage: asNum(r.completed_mileage),
    status: String(r.status ?? "scheduled"),
    notes: asStr(r.notes),
    created_at: asIso(r.created_at),
    updated_at: asIso(r.updated_at),
  };
}

function mapWarranty(r: Row): WarrantyRecord {
  return {
    id: r.id,
    vehicle_id: String(r.vehicle_id ?? ""),
    invoice_id: asStr(r.invoice_id),
    invoice_part_id: asStr(r.invoice_part_id),
    invoice_labor_id: asStr(r.invoice_labor_id),
    component: asStr(r.component),
    category: asStr(r.category),
    warranty_available: asBool(r.warranty_available, true),
    warranty_provider: asStr(r.warranty_provider),
    warranty_start_date: asDate(r.warranty_start_date),
    warranty_end_date: asDate(r.warranty_end_date),
    warranty_mileage_limit: asNum(r.warranty_mileage_limit),
    warranty_notes: asStr(r.warranty_notes),
    created_at: asIso(r.created_at),
    updated_at: asIso(r.updated_at),
  };
}

function mapAudit(r: Row): AuditLog {
  return {
    id: r.id,
    user_id: asStr(r.user_id),
    entity_type: String(r.entity_type ?? ""),
    entity_id: asStr(r.entity_id),
    action: (asStr(r.action) as AuditLog["action"]) || "update",
    field_name: asStr(r.field_name),
    old_value: asStr(r.old_value),
    new_value: asStr(r.new_value),
    metadata: (r.metadata as AuditLog["metadata"]) ?? null,
    created_at: asIso(r.created_at),
  };
}

function emptyStore(): FleetStore {
  return {
    profiles: [],
    repair_categories: [],
    clients: [],
    vehicles: [],
    repair_shops: [],
    invoices: [],
    invoice_parts: [],
    invoice_labor: [],
    payments: [],
    documents: [],
    mileage_history: [],
    maintenance_records: [],
    warranty_records: [],
    audit_logs: [],
  };
}

export async function loadSupabaseStore(): Promise<FleetStore> {
  const client = requireAdminSupabase();
  const [
    profiles,
    repair_categories,
    clients,
    vehicles,
    repair_shops,
    invoices,
    invoice_parts,
    invoice_labor,
    payments,
    documents,
    mileage_history,
    maintenance_records,
    warranty_records,
    audit_logs,
  ] = await Promise.all([
    fetchAll<Row>(client, "profiles"),
    fetchAll<Row>(client, "repair_categories"),
    fetchAll<Row>(client, "fleet_clients"),
    fetchAll<Row>(client, "vehicles"),
    fetchAll<Row>(client, "repair_shops"),
    fetchAll<Row>(client, "invoices"),
    fetchAll<Row>(client, "invoice_parts"),
    fetchAll<Row>(client, "invoice_labor"),
    fetchAll<Row>(client, "payments"),
    fetchAll<Row>(client, "documents"),
    fetchAll<Row>(client, "mileage_history"),
    fetchAll<Row>(client, "maintenance_records"),
    fetchAll<Row>(client, "warranty_records"),
    fetchAll<Row>(client, "audit_logs"),
  ]);

  const store: FleetStore = {
    profiles: profiles.map(mapProfile),
    repair_categories: repair_categories.map(mapCategory),
    clients: clients.map(mapClient),
    vehicles: vehicles.map(mapVehicle),
    repair_shops: repair_shops.map(mapShop),
    invoices: invoices.map(mapInvoice),
    invoice_parts: invoice_parts.map(mapPart),
    invoice_labor: invoice_labor.map(mapLabor),
    payments: payments.map(mapPayment),
    documents: documents.map(mapDocument),
    mileage_history: flagMileageAnomalies(mileage_history.map(mapMileage)),
    maintenance_records: maintenance_records.map(mapMaintenance),
    warranty_records: warranty_records.map(mapWarranty),
    audit_logs: audit_logs.map(mapAudit),
  };
  return normalizeStore(store);
}

function changed(a: unknown, b: unknown) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

async function deleteIds(client: SupabaseClient, table: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += PAGE) {
    const chunk = ids.slice(i, i + PAGE);
    const { error } = await client.from(table).delete().in("id", chunk);
    throwIfError(error, `Failed to delete from ${table}`);
  }
}

async function upsertRows(client: SupabaseClient, table: string, rows: Row[]) {
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await client.from(table).upsert(chunk);
    throwIfError(error, `Failed to upsert ${table}`);
  }
}

function diff(prev: { id: string }[], next: { id: string }[]) {
  const prevById = new Map(prev.map((r) => [r.id, r]));
  const nextIds = new Set(next.map((r) => r.id));
  return {
    toDelete: prev.filter((r) => !nextIds.has(r.id)).map((r) => r.id),
    toUpsert: next.filter((r) => {
      const p = prevById.get(r.id);
      return !p || changed(p, r);
    }) as Row[],
  };
}

function invoiceWriteRow(inv: Invoice, sourceDocumentId: string | null = inv.source_document_id): Row {
  return {
    id: inv.id,
    invoice_number: inv.invoice_number,
    vehicle_id: inv.vehicle_id,
    repair_shop_id: inv.repair_shop_id,
    invoice_date: inv.invoice_date,
    printed_date: inv.printed_date,
    proposed_completion_date: inv.proposed_completion_date,
    work_completed_date: inv.work_completed_date,
    customer_name: inv.customer_name,
    customer_id: inv.customer_id,
    license_number: inv.license_number,
    license_state: inv.license_state,
    odometer_in: inv.odometer_in,
    technician_name: inv.technician_name,
    technician_certification_number: inv.technician_certification_number,
    labor_total: inv.labor_total,
    parts_total: inv.parts_total,
    subtotal: inv.subtotal,
    tax: inv.tax,
    invoice_total: inv.invoice_total,
    calculated_total: inv.calculated_total,
    balance_due: inv.balance_due,
    payment_status: inv.payment_status,
    payment_method: inv.payment_method,
    original_estimate_amount: inv.original_estimate_amount,
    notes: inv.notes,
    source_document_id: sourceDocumentId,
    ocr_status: inv.ocr_status,
    ocr_confidence: inv.ocr_confidence,
    ocr_payload: inv.ocr_payload,
    manually_verified: inv.manually_verified,
    verified_by: inv.verified_by,
    verified_at: inv.verified_at,
    created_by: inv.created_by,
    created_at: inv.created_at,
    updated_at: inv.updated_at,
  };
}

export async function persistSupabaseStore(next: FleetStore, prev: FleetStore = emptyStore()) {
  const client = requireAdminSupabase();

  const categories = diff(prev.repair_categories, next.repair_categories);
  const clients = diff(prev.clients, next.clients);
  const shops = diff(prev.repair_shops, next.repair_shops);
  const vehicles = diff(prev.vehicles, next.vehicles);
  const invoices = diff(prev.invoices, next.invoices);
  const parts = diff(prev.invoice_parts, next.invoice_parts);
  const labor = diff(prev.invoice_labor, next.invoice_labor);
  const payments = diff(prev.payments, next.payments);
  const documents = diff(prev.documents, next.documents);
  const mileage = diff(prev.mileage_history, next.mileage_history);
  const maintenance = diff(prev.maintenance_records, next.maintenance_records);
  const warranty = diff(prev.warranty_records, next.warranty_records);
  const audit = diff(prev.audit_logs, next.audit_logs);

  if (documents.toDelete.length) {
    const { error } = await client
      .from("invoices")
      .update({ source_document_id: null })
      .in("source_document_id", documents.toDelete);
    throwIfError(error, "Failed to clear invoice source documents");
  }

  await deleteIds(client, "audit_logs", audit.toDelete);
  await deleteIds(client, "warranty_records", warranty.toDelete);
  await deleteIds(client, "maintenance_records", maintenance.toDelete);
  await deleteIds(client, "mileage_history", mileage.toDelete);
  await deleteIds(client, "payments", payments.toDelete);
  await deleteIds(client, "invoice_parts", parts.toDelete);
  await deleteIds(client, "invoice_labor", labor.toDelete);
  await deleteIds(client, "documents", documents.toDelete);
  await deleteIds(client, "invoices", invoices.toDelete);
  await deleteIds(client, "vehicles", vehicles.toDelete);
  await deleteIds(client, "repair_shops", shops.toDelete);
  await deleteIds(client, "fleet_clients", clients.toDelete);
  await deleteIds(client, "repair_categories", categories.toDelete);

  await upsertRows(
    client,
    "repair_categories",
    categories.toUpsert.map((c) => ({ ...c })),
  );
  await upsertRows(
    client,
    "fleet_clients",
    clients.toUpsert.map((c) => ({ ...c })),
  );
  await upsertRows(
    client,
    "repair_shops",
    shops.toUpsert.map((s) => ({ ...s })),
  );
  await upsertRows(
    client,
    "vehicles",
    vehicles.toUpsert.map((v) => ({ ...v })),
  );

  const invoiceUpserts = invoices.toUpsert as unknown as Invoice[];
  await upsertRows(
    client,
    "invoices",
    invoiceUpserts.map((inv) => invoiceWriteRow(inv, null)),
  );
  await upsertRows(
    client,
    "documents",
    documents.toUpsert.map((d) => ({ ...d })),
  );

  const needSource = invoiceUpserts.filter((inv) => inv.source_document_id);
  for (const inv of needSource) {
    const { error } = await client
      .from("invoices")
      .update({ source_document_id: inv.source_document_id, updated_at: inv.updated_at })
      .eq("id", inv.id);
    throwIfError(error, `Failed to set source document on invoice ${inv.id}`);
  }

  await upsertRows(client, "invoice_parts", parts.toUpsert.map((p) => ({ ...p })));
  await upsertRows(client, "invoice_labor", labor.toUpsert.map((l) => ({ ...l })));
  await upsertRows(client, "payments", payments.toUpsert.map((p) => ({ ...p })));
  await upsertRows(
    client,
    "mileage_history",
    mileage.toUpsert.map((m) => ({ ...m })),
  );
  await upsertRows(
    client,
    "maintenance_records",
    maintenance.toUpsert.map((m) => ({ ...m })),
  );
  await upsertRows(
    client,
    "warranty_records",
    warranty.toUpsert.map((w) => ({ ...w })),
  );
  await upsertRows(client, "audit_logs", audit.toUpsert.map((a) => ({ ...a })));
}

export async function resetSupabaseStore(): Promise<FleetStore> {
  const seed = normalizeStore(createSeedStore());
  seed.mileage_history = flagMileageAnomalies(seed.mileage_history);
  const current = await loadSupabaseStore();
  await persistSupabaseStore(seed, current);
  return seed;
}

export async function pingSupabase() {
  const client = requireAdminSupabase();
  const { error } = await client.from("repair_categories").select("id").limit(1);
  return { ok: !error, error: error?.message ?? null };
}
