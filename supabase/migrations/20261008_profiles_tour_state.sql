-- 2026-10-08: Produktgjennomgangene («sett» per tour + av-bryteren) lå kun i
-- nettleserens localStorage. Dermed kom de tilbake på hver ny maskin/nettleser,
-- og Nina (hjem.no) som bytter mellom PC og telefon så dem på nytt hver gang.
-- Nå lagres tilstanden på kontoen:
--   { "av": true|false, "sett": ["rh_tour_property_setup", ...] }
-- Lesing/skriving går via /api/profile/tour-state (service_role etter auth),
-- så ingen ny RLS-policy trengs. localStorage beholdes som rask reserve.
-- Kjørt live via management-API 2026-10-08.

alter table public.profiles
  add column if not exists tour_state jsonb not null default '{}'::jsonb;
