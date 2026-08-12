-- RLS + grants for fleet_clients (table added in 0004 after the original grants).

ALTER TABLE public.fleet_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fleet_clients_select ON public.fleet_clients;
CREATE POLICY fleet_clients_select ON public.fleet_clients
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fleet_clients_write ON public.fleet_clients;
CREATE POLICY fleet_clients_write ON public.fleet_clients
  FOR ALL TO authenticated
  USING (public.can_manage())
  WITH CHECK (public.can_manage());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_clients TO authenticated;
GRANT ALL ON public.fleet_clients TO service_role, postgres;
GRANT SELECT ON public.fleet_clients TO anon;
