-- Kjort live 2026-08-08 via management-API.
-- Kjede-merkevarestyring: kjeden/meglerhuset kan sette en OFFISIELL logo som
-- meglerne arver og ikke kan overstyre. Losningsrekkefolge i lib/org-branding:
--   kjedens logo -> kontorets logo -> meglerens egen.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url text;
GRANT SELECT, INSERT, UPDATE ON organizations TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
