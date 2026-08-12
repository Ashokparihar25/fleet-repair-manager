-- Fleet customers (e.g. Cardeed). Vehicles belong to a client.
-- VIN remains the global matching key. Fleet IDs are unique per client.

CREATE TABLE public.fleet_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  slug TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER fleet_clients_set_updated_at
  BEFORE UPDATE ON public.fleet_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX fleet_clients_name_trgm_idx ON public.fleet_clients USING gin (name gin_trgm_ops);

ALTER TABLE public.vehicles
  ADD COLUMN client_id UUID REFERENCES public.fleet_clients (id) ON DELETE SET NULL;

CREATE INDEX vehicles_client_id_idx ON public.vehicles (client_id);

DROP INDEX IF EXISTS public.vehicles_fleet_id_unique;

CREATE UNIQUE INDEX vehicles_client_fleet_id_unique
  ON public.vehicles (client_id, vehicle_id)
  WHERE vehicle_id IS NOT NULL AND client_id IS NOT NULL;

INSERT INTO public.fleet_clients (
  id, name, legal_name, slug, email, phone, website, address, city, state, zip, notes
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
  'Cardeed',
  'Cardeed LLC',
  'cardeed',
  'info@cardeed.com',
  '+1 (734) 888-9595',
  'https://cardeed.com',
  '38099 Schoolcraft Rd, Suite 182',
  'Livonia',
  'MI',
  '48150',
  'Rental / host fleet. Vehicles are repaired at LALA AUTO REPAIR LLC.'
) ON CONFLICT (id) DO NOTHING;

UPDATE public.vehicles
SET client_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001'
WHERE client_id IS NULL;
