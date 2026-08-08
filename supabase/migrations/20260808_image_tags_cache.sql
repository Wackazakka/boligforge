-- Kjørt live 2026-08-08 via management-API.
-- Cache for bildeklassifisering (rom-kategori per bilde-URL). Uten denne ble
-- HELE annonsen klassifisert på nytt hver gang megleren delte opp manuset i
-- segmenter -- vanlig etter manusjusteringer, og full pris hver gang.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS image_tags jsonb;
GRANT SELECT, INSERT, UPDATE ON properties TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
