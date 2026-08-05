-- Videooppskrift: manus + segmenter (med innlesinger og godkjente avatar-klipp)
-- + outro/valg lagres per generert video, saa "Rediger" paa en tidligere video
-- kan gjenopprette redigeringstilstanden. Kjoert mot live 2026-08-05 via
-- management-API. Idempotent. (ASCII med vilje - SQL-editor-UTF8-fellen.)

ALTER TABLE property_videos ADD COLUMN IF NOT EXISTS recipe jsonb;

NOTIFY pgrst, 'reload schema';
