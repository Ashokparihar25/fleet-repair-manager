-- =============================================================================
-- Fleet Repair Manager — initial schema
-- =============================================================================
-- Designed for 50+ vehicles, multiple shops, thousands of invoices.
-- VIN is the primary vehicle matching key. Fleet ID (vehicles.vehicle_id) is
-- an auxiliary internal identifier and is NEVER used as the primary identity.
-- Parts and labor are stored in separate tables. Source invoice totals are
-- never overwritten by calculated totals.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'staff', 'viewer');

CREATE TYPE public.vehicle_status AS ENUM (
  'available',
  'in_shop',
  'out_of_service',
  'sold',
  'pending_inspection'
);

CREATE TYPE public.payment_status AS ENUM (
  'paid',
  'partially_paid',
  'unpaid',
  'voided'
);

CREATE TYPE public.payment_method AS ENUM (
  'visa',
  'mastercard',
  'amex',
  'discover',
  'cash',
  'check',
  'ach',
  'other'
);

CREATE TYPE public.ocr_status AS ENUM (
  'not_processed',
  'pending',
  'processed',
  'failed',
  'needs_review',
  'skipped'
);

CREATE TYPE public.document_type AS ENUM (
  'invoice',
  'estimate',
  'receipt',
  'warranty',
  'inspection',
  'other'
);

CREATE TYPE public.audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'verify',
  'upload',
  'login'
);

-- ---------------------------------------------------------------------------
-- Helper: updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (maps to auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role public.user_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Repair categories
-- ---------------------------------------------------------------------------

CREATE TABLE public.repair_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER repair_categories_set_updated_at
  BEFORE UPDATE ON public.repair_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vehicles
-- VIN is the unique matching identifier when present.
-- vehicle_id stores the internal fleet ID (A010, A016, …).
-- ---------------------------------------------------------------------------

CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id TEXT,
  vin TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  trim TEXT,
  engine TEXT,
  body_style TEXT,
  license_plate TEXT,
  state TEXT,
  current_mileage INTEGER,
  purchase_date DATE,
  purchase_price NUMERIC(12, 2),
  acquisition_source TEXT,
  status public.vehicle_status NOT NULL DEFAULT 'available',
  color TEXT,
  notes TEXT,
  rental_revenue_total NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vehicles_vin_len CHECK (vin IS NULL OR char_length(vin) = 17),
  CONSTRAINT vehicles_vin_format CHECK (vin IS NULL OR vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  CONSTRAINT vehicles_mileage_nonneg CHECK (current_mileage IS NULL OR current_mileage >= 0)
);

CREATE UNIQUE INDEX vehicles_vin_unique
  ON public.vehicles (vin)
  WHERE vin IS NOT NULL;

CREATE UNIQUE INDEX vehicles_fleet_id_unique
  ON public.vehicles (vehicle_id)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX vehicles_vehicle_id_idx ON public.vehicles (vehicle_id);
CREATE INDEX vehicles_vin_idx ON public.vehicles (vin);
CREATE INDEX vehicles_make_model_idx ON public.vehicles (make, model);
CREATE INDEX vehicles_status_idx ON public.vehicles (status);
CREATE INDEX vehicles_vin_trgm_idx ON public.vehicles USING gin (vin gin_trgm_ops);
CREATE INDEX vehicles_fleet_trgm_idx ON public.vehicles USING gin (vehicle_id gin_trgm_ops);
CREATE INDEX vehicles_plate_trgm_idx ON public.vehicles USING gin (license_plate gin_trgm_ops);

CREATE TRIGGER vehicles_set_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Repair shops (multiple shops supported)
-- ---------------------------------------------------------------------------

CREATE TABLE public.repair_shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  fax TEXT,
  registration_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX repair_shops_name_idx ON public.repair_shops (name);
CREATE INDEX repair_shops_name_trgm_idx ON public.repair_shops USING gin (name gin_trgm_ops);

CREATE TRIGGER repair_shops_set_updated_at
  BEFORE UPDATE ON public.repair_shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Invoices
-- invoice_total = extracted/source total (never overwritten)
-- calculated_total = parts + labor + tax from line items
-- ---------------------------------------------------------------------------

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT,
  vehicle_id UUID REFERENCES public.vehicles (id) ON DELETE SET NULL,
  repair_shop_id UUID REFERENCES public.repair_shops (id) ON DELETE SET NULL,
  invoice_date DATE,
  printed_date DATE,
  proposed_completion_date DATE,
  work_completed_date DATE,
  customer_name TEXT,
  customer_id TEXT,
  license_number TEXT,
  license_state TEXT,
  odometer_in INTEGER,
  technician_name TEXT,
  technician_certification_number TEXT,
  labor_total NUMERIC(12, 2),
  parts_total NUMERIC(12, 2),
  subtotal NUMERIC(12, 2),
  tax NUMERIC(12, 2),
  invoice_total NUMERIC(12, 2),
  calculated_total NUMERIC(12, 2),
  balance_due NUMERIC(12, 2),
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  payment_method public.payment_method,
  original_estimate_amount NUMERIC(12, 2),
  notes TEXT,
  source_document_id UUID,
  ocr_status public.ocr_status NOT NULL DEFAULT 'not_processed',
  ocr_confidence NUMERIC(5, 2),
  ocr_payload JSONB,
  manually_verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_odometer_nonneg CHECK (odometer_in IS NULL OR odometer_in >= 0)
);

CREATE INDEX invoices_number_idx ON public.invoices (invoice_number);
CREATE INDEX invoices_date_idx ON public.invoices (invoice_date DESC);
CREATE INDEX invoices_work_completed_idx ON public.invoices (work_completed_date DESC);
CREATE INDEX invoices_vehicle_id_idx ON public.invoices (vehicle_id);
CREATE INDEX invoices_repair_shop_id_idx ON public.invoices (repair_shop_id);
CREATE INDEX invoices_payment_status_idx ON public.invoices (payment_status);
CREATE INDEX invoices_ocr_status_idx ON public.invoices (ocr_status);
CREATE INDEX invoices_customer_id_idx ON public.invoices (customer_id);
CREATE INDEX invoices_number_trgm_idx ON public.invoices USING gin (invoice_number gin_trgm_ops);
CREATE INDEX invoices_customer_trgm_idx ON public.invoices USING gin (customer_id gin_trgm_ops);

CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Invoice parts (independent of labor)
-- ---------------------------------------------------------------------------

CREATE TABLE public.invoice_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  part_description TEXT NOT NULL,
  part_number TEXT,
  manufacturer_part_number TEXT,
  quantity NUMERIC(12, 3),
  unit_price NUMERIC(12, 2),
  extended_price NUMERIC(12, 2),
  category TEXT REFERENCES public.repair_categories (slug),
  side TEXT,
  position TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invoice_parts_invoice_id_idx ON public.invoice_parts (invoice_id);
CREATE INDEX invoice_parts_part_number_idx ON public.invoice_parts (part_number);
CREATE INDEX invoice_parts_category_idx ON public.invoice_parts (category);
CREATE INDEX invoice_parts_description_trgm_idx
  ON public.invoice_parts USING gin (part_description gin_trgm_ops);
CREATE INDEX invoice_parts_number_trgm_idx
  ON public.invoice_parts USING gin (part_number gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Invoice labor (independent of parts — do not 1:1 join)
-- ---------------------------------------------------------------------------

CREATE TABLE public.invoice_labor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  labor_description TEXT NOT NULL,
  labor_category TEXT REFERENCES public.repair_categories (slug),
  extended_amount NUMERIC(12, 2),
  technician TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invoice_labor_invoice_id_idx ON public.invoice_labor (invoice_id);
CREATE INDEX invoice_labor_category_idx ON public.invoice_labor (labor_category);
CREATE INDEX invoice_labor_description_trgm_idx
  ON public.invoice_labor USING gin (labor_description gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Payments (an invoice may have multiple payments)
-- ---------------------------------------------------------------------------

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  payment_date DATE,
  amount NUMERIC(12, 2) NOT NULL,
  payment_method public.payment_method,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_invoice_id_idx ON public.payments (invoice_id);
CREATE INDEX payments_date_idx ON public.payments (payment_date DESC);

-- ---------------------------------------------------------------------------
-- Documents (original invoice PDF/image is never deleted when OCR is edited)
-- ---------------------------------------------------------------------------

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices (id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles (id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  document_type public.document_type NOT NULL DEFAULT 'invoice',
  ocr_processed BOOLEAN NOT NULL DEFAULT false,
  ocr_confidence NUMERIC(5, 2)
);

CREATE INDEX documents_invoice_id_idx ON public.documents (invoice_id);
CREATE INDEX documents_vehicle_id_idx ON public.documents (vehicle_id);
CREATE INDEX documents_type_idx ON public.documents (document_type);

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_source_document_fk
  FOREIGN KEY (source_document_id) REFERENCES public.documents (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Mileage history (created from invoice odometer readings; never silently corrected)
-- ---------------------------------------------------------------------------

CREATE TABLE public.mileage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices (id) ON DELETE SET NULL,
  recorded_at DATE NOT NULL,
  mileage INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'invoice',
  anomaly BOOLEAN NOT NULL DEFAULT false,
  anomaly_note TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mileage_history_nonneg CHECK (mileage >= 0)
);

CREATE INDEX mileage_history_vehicle_id_idx ON public.mileage_history (vehicle_id);
CREATE INDEX mileage_history_recorded_at_idx ON public.mileage_history (recorded_at);
CREATE INDEX mileage_history_invoice_id_idx ON public.mileage_history (invoice_id);
CREATE INDEX mileage_history_anomaly_idx ON public.mileage_history (anomaly)
  WHERE anomaly = true;

-- ---------------------------------------------------------------------------
-- Maintenance records (schedules / preventive work beyond invoices)
-- ---------------------------------------------------------------------------

CREATE TABLE public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices (id) ON DELETE SET NULL,
  category TEXT REFERENCES public.repair_categories (slug),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  due_mileage INTEGER,
  completed_at DATE,
  completed_mileage INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX maintenance_records_vehicle_id_idx ON public.maintenance_records (vehicle_id);
CREATE INDEX maintenance_records_category_idx ON public.maintenance_records (category);
CREATE INDEX maintenance_records_status_idx ON public.maintenance_records (status);

CREATE TRIGGER maintenance_records_set_updated_at
  BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Warranty records
-- ---------------------------------------------------------------------------

CREATE TABLE public.warranty_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices (id) ON DELETE SET NULL,
  invoice_part_id UUID REFERENCES public.invoice_parts (id) ON DELETE SET NULL,
  invoice_labor_id UUID REFERENCES public.invoice_labor (id) ON DELETE SET NULL,
  component TEXT,
  category TEXT REFERENCES public.repair_categories (slug),
  warranty_available BOOLEAN NOT NULL DEFAULT true,
  warranty_provider TEXT,
  warranty_start_date DATE,
  warranty_end_date DATE,
  warranty_mileage_limit INTEGER,
  warranty_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX warranty_records_vehicle_id_idx ON public.warranty_records (vehicle_id);
CREATE INDEX warranty_records_invoice_id_idx ON public.warranty_records (invoice_id);
CREATE INDEX warranty_records_category_idx ON public.warranty_records (category);

CREATE TRIGGER warranty_records_set_updated_at
  BEFORE UPDATE ON public.warranty_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit logs
-- ---------------------------------------------------------------------------

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action public.audit_action NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_user_id_idx ON public.audit_logs (user_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- New user → profile
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'viewer')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.can_write()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() IN ('admin', 'manager', 'staff'), false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() IN ('admin', 'manager'), false);
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Roles:
--   Admin   — full access
--   Manager — create/edit invoices and vehicles
--   Staff   — upload invoices and OCR verification
--   Viewer  — read-only
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Categories
CREATE POLICY categories_select ON public.repair_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY categories_write ON public.repair_categories
  FOR ALL TO authenticated
  USING (public.can_manage())
  WITH CHECK (public.can_manage());

-- Vehicles
CREATE POLICY vehicles_select ON public.vehicles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY vehicles_insert ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write());
CREATE POLICY vehicles_update ON public.vehicles
  FOR UPDATE TO authenticated
  USING (public.can_manage())
  WITH CHECK (public.can_manage());
CREATE POLICY vehicles_delete ON public.vehicles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Shops
CREATE POLICY shops_select ON public.repair_shops
  FOR SELECT TO authenticated USING (true);
CREATE POLICY shops_write ON public.repair_shops
  FOR ALL TO authenticated
  USING (public.can_manage())
  WITH CHECK (public.can_manage());

-- Invoices
CREATE POLICY invoices_select ON public.invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY invoices_insert ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write());
CREATE POLICY invoices_update ON public.invoices
  FOR UPDATE TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());
CREATE POLICY invoices_delete ON public.invoices
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Parts
CREATE POLICY parts_select ON public.invoice_parts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY parts_write ON public.invoice_parts
  FOR ALL TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());

-- Labor
CREATE POLICY labor_select ON public.invoice_labor
  FOR SELECT TO authenticated USING (true);
CREATE POLICY labor_write ON public.invoice_labor
  FOR ALL TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());

-- Payments
CREATE POLICY payments_select ON public.payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY payments_write ON public.payments
  FOR ALL TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());

-- Documents
CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY documents_insert ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write());
CREATE POLICY documents_update ON public.documents
  FOR UPDATE TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());
CREATE POLICY documents_delete ON public.documents
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Mileage
CREATE POLICY mileage_select ON public.mileage_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY mileage_write ON public.mileage_history
  FOR ALL TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());

-- Maintenance
CREATE POLICY maintenance_select ON public.maintenance_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY maintenance_write ON public.maintenance_records
  FOR ALL TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());

-- Warranty
CREATE POLICY warranty_select ON public.warranty_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY warranty_write ON public.warranty_records
  FOR ALL TO authenticated
  USING (public.can_write())
  WITH CHECK (public.can_write());

-- Audit (append-only for writers; admin can read all)
CREATE POLICY audit_select ON public.audit_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY audit_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write());

-- ---------------------------------------------------------------------------
-- Storage: original invoice PDFs/images
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-documents', 'invoice-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY invoice_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'invoice-documents');

CREATE POLICY invoice_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoice-documents' AND public.can_write());

CREATE POLICY invoice_docs_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'invoice-documents' AND public.can_write())
  WITH CHECK (bucket_id = 'invoice-documents' AND public.can_write());

CREATE POLICY invoice_docs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'invoice-documents' AND public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
