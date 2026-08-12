export type UserRole = "admin" | "manager" | "staff" | "viewer";

export type VehicleStatus =
  | "available"
  | "in_shop"
  | "out_of_service"
  | "sold"
  | "pending_inspection";

export type PaymentStatus = "paid" | "partially_paid" | "unpaid" | "voided";

export type PaymentMethod =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "cash"
  | "check"
  | "ach"
  | "other";

export type OcrStatus =
  | "not_processed"
  | "pending"
  | "processed"
  | "failed"
  | "needs_review"
  | "skipped";

export type DocumentType =
  | "invoice"
  | "estimate"
  | "receipt"
  | "warranty"
  | "inspection"
  | "other";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "verify"
  | "upload"
  | "login";

export type RepairCategorySlug =
  | "brakes"
  | "suspension"
  | "steering"
  | "engine"
  | "transmission"
  | "electrical"
  | "cooling"
  | "ac_heating"
  | "exhaust"
  | "tires"
  | "wheel_hubs"
  | "battery"
  | "alternator"
  | "starter"
  | "fluids"
  | "preventive"
  | "body"
  | "glass"
  | "lighting"
  | "other";

/** Money is always stored/transported as decimal strings, never floats. */
export type Money = string | null;

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface RepairCategory {
  id: string;
  slug: RepairCategorySlug | string;
  name: string;
  description: string | null;
  keywords: string[];
  created_at: string;
  updated_at: string;
}

export interface FleetClient {
  id: string;
  name: string;
  legal_name: string | null;
  slug: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  /** Fleet customer / rental company that owns this vehicle. */
  client_id: string | null;
  /** Internal fleet identifier (A010). Auxiliary — not the primary identity. */
  vehicle_id: string | null;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  engine: string | null;
  body_style: string | null;
  license_plate: string | null;
  state: string | null;
  current_mileage: number | null;
  purchase_date: string | null;
  purchase_price: Money;
  acquisition_source: string | null;
  status: VehicleStatus;
  color: string | null;
  notes: string | null;
  rental_revenue_total: Money;
  created_at: string;
  updated_at: string;
}

export interface RepairShop {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  fax: string | null;
  registration_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractedField<T = string | number | null> {
  source_value: string | null;
  normalized_value: T;
  confidence: number | null;
  verified: boolean;
}

export interface OcrPayload {
  repair_shop?: {
    name?: ExtractedField<string | null>;
    address?: ExtractedField<string | null>;
    phone?: ExtractedField<string | null>;
    fax?: ExtractedField<string | null>;
    michigan_registration?: ExtractedField<string | null>;
  };
  invoice?: Record<string, ExtractedField>;
  vehicle?: Record<string, ExtractedField>;
  parts?: Array<{
    description: ExtractedField<string | null>;
    part_number: ExtractedField<string | null>;
    quantity: ExtractedField<number | null>;
    unit_price: ExtractedField<string | null>;
    extended_price: ExtractedField<string | null>;
  }>;
  labor?: Array<{
    description: ExtractedField<string | null>;
    amount: ExtractedField<string | null>;
  }>;
  technician?: {
    name?: ExtractedField<string | null>;
    certification_number?: ExtractedField<string | null>;
  };
  raw_text?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string | null;
  vehicle_id: string | null;
  repair_shop_id: string | null;
  invoice_date: string | null;
  printed_date: string | null;
  proposed_completion_date: string | null;
  work_completed_date: string | null;
  customer_name: string | null;
  customer_id: string | null;
  license_number: string | null;
  license_state: string | null;
  odometer_in: number | null;
  technician_name: string | null;
  technician_certification_number: string | null;
  labor_total: Money;
  parts_total: Money;
  subtotal: Money;
  tax: Money;
  /** Extracted/source invoice total. Never overwrite with a calculated value. */
  invoice_total: Money;
  /** parts + labor + tax from line items / printed subtotals. */
  calculated_total: Money;
  balance_due: Money;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  original_estimate_amount: Money;
  notes: string | null;
  source_document_id: string | null;
  ocr_status: OcrStatus;
  ocr_confidence: number | null;
  ocr_payload: OcrPayload | null;
  manually_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoicePart {
  id: string;
  invoice_id: string;
  part_description: string;
  part_number: string | null;
  manufacturer_part_number: string | null;
  quantity: string | null;
  unit_price: Money;
  extended_price: Money;
  category: string | null;
  side: string | null;
  position: string | null;
  notes: string | null;
  created_at: string;
}

export interface InvoiceLabor {
  id: string;
  invoice_id: string;
  labor_description: string;
  labor_category: string | null;
  extended_amount: Money;
  technician: string | null;
  notes: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  payment_date: string | null;
  amount: string;
  payment_method: PaymentMethod | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  invoice_id: string | null;
  vehicle_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
  document_type: DocumentType;
  ocr_processed: boolean;
  ocr_confidence: number | null;
}

export interface MileageHistory {
  id: string;
  vehicle_id: string;
  invoice_id: string | null;
  recorded_at: string;
  mileage: number;
  source: string;
  anomaly: boolean;
  anomaly_note: string | null;
  notes: string | null;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  invoice_id: string | null;
  category: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  due_mileage: number | null;
  completed_at: string | null;
  completed_mileage: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarrantyRecord {
  id: string;
  vehicle_id: string;
  invoice_id: string | null;
  invoice_part_id: string | null;
  invoice_labor_id: string | null;
  component: string | null;
  category: string | null;
  warranty_available: boolean;
  warranty_provider: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  warranty_mileage_limit: number | null;
  warranty_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: AuditAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AlertItem {
  id: string;
  type:
    | "mileage_anomaly"
    | "duplicate_invoice"
    | "invoice_discrepancy"
    | "missing_vin"
    | "unknown_vehicle"
    | "unknown_shop"
    | "ocr_confidence_low"
    | "missing_payment"
    | "balance_due"
    | "repeated_repair"
    | "possible_warranty"
    | "missing_invoice_number"
    | "missing_odometer"
    | "overdue_maintenance"
    | "maintenance_due";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  invoice_id?: string | null;
  vehicle_id?: string | null;
  href?: string;
}

export interface InvoiceDiscrepancy {
  hasDiscrepancy: boolean;
  invoiceTotal: string | null;
  expectedTotal: string | null;
  difference: string | null;
}

export interface VehicleCostAnalysis {
  vehicleId: string;
  fleetId: string | null;
  totalPartsCost: string;
  totalLaborCost: string;
  totalTax: string;
  totalRepairCost: string;
  numberOfRepairs: number;
  averageRepairCost: string;
  repairCostPerMile: string | null;
  repairCostPerMonth: string | null;
  lastRepairDate: string | null;
  lastRepairMileage: number | null;
  purchasePrice: string | null;
  totalRepairInvestment: string;
  totalOperatingCost: string | null;
  rentalRevenue: string | null;
  netRevenue: string | null;
  roi: string | null;
}

export interface DashboardStats {
  totalVehicles: number;
  repairInvoices: number;
  totalRepairSpend: string;
  thisMonth: string;
  thisYear: string;
  averageRepairCost: string;
  mostExpensiveVehicle: {
    id: string;
    fleetId: string | null;
    label: string;
    total: string;
  } | null;
  mostCommonRepair: { category: string; name: string; count: number } | null;
  topRepairShop: { id: string; name: string; total: string } | null;
}

export interface FleetStore {
  profiles: Profile[];
  repair_categories: RepairCategory[];
  clients: FleetClient[];
  vehicles: Vehicle[];
  repair_shops: RepairShop[];
  invoices: Invoice[];
  invoice_parts: InvoicePart[];
  invoice_labor: InvoiceLabor[];
  payments: Payment[];
  documents: DocumentRecord[];
  mileage_history: MileageHistory[];
  maintenance_records: MaintenanceRecord[];
  warranty_records: WarrantyRecord[];
  audit_logs: AuditLog[];
}

export type InvoiceWithRelations = Invoice & {
  vehicle: Vehicle | null;
  shop: RepairShop | null;
  parts: InvoicePart[];
  labor: InvoiceLabor[];
  payments: Payment[];
  documents: DocumentRecord[];
};

export type VehicleWithRelations = Vehicle & {
  client: FleetClient | null;
  invoices: InvoiceWithRelations[];
  mileage: MileageHistory[];
  warranties: WarrantyRecord[];
  maintenance: MaintenanceRecord[];
  documents: DocumentRecord[];
  cost: VehicleCostAnalysis;
};

export interface InvoiceFilters {
  vehicleId?: string;
  fleetId?: string;
  vin?: string;
  shopId?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  paymentStatus?: PaymentStatus;
  technician?: string;
  year?: number;
  make?: string;
  model?: string;
  minCost?: string;
  maxCost?: string;
  q?: string;
}

export interface OcrExtractionResult {
  repair_shop: {
    name: string | null;
    address: string | null;
    phone: string | null;
    fax: string | null;
    michigan_registration: string | null;
  };
  invoice: {
    invoice_number: string | null;
    printed_date: string | null;
    proposed_completion_date: string | null;
    work_completed_date: string | null;
    customer_name: string | null;
    customer_id: string | null;
    license_number: string | null;
    license_state: string | null;
    odometer_in: number | null;
    vin: string | null;
    original_estimate_amount: string | null;
    labor_total: string | null;
    parts_total: string | null;
    subtotal: string | null;
    tax: string | null;
    total: string | null;
    balance_due: string | null;
    payment_method: string | null;
    payment_amount: string | null;
  };
  vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    engine: string | null;
    vin: string | null;
  };
  parts: Array<{
    description: string | null;
    part_number: string | null;
    quantity: number | null;
    unit_price: string | null;
    extended_price: string | null;
  }>;
  labor: Array<{
    description: string | null;
    amount: string | null;
  }>;
  technician: {
    name: string | null;
    certification_number: string | null;
  };
  field_confidence: Record<string, number>;
  overall_confidence: number;
  ocr_payload: OcrPayload;
}
