-- Kjede-hierarki: en kjede ER en organization; kontorer peker paa forelderen.
-- Kjoert mot live 2026-08-05 via management-API. Idempotent.
-- (ASCII med vilje - SQL-editor-UTF8-fellen.)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS parent_organization_id uuid
  REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_parent
  ON organizations(parent_organization_id);

NOTIFY pgrst, 'reload schema';
