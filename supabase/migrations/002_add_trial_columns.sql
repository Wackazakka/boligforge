-- ============================================================
-- ReelHome — Legg til trial_ends_at på organizations
-- Idempotent: trygt å kjøre flere ganger
-- ============================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
