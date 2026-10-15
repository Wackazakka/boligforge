-- 2026-10-16: Valget øverst på produksjonssiden («Rask story» eller «Film med
-- stemme og avatar», avtalen med hjem.no) huskes på kontoen, så den som alltid
-- lager story slipper å velge hver gang. null = ikke valgt ennå (viser valget).
-- Lesing/skriving via /api/profile/prod-modus (service_role etter auth).

alter table public.profiles
  add column if not exists prod_modus text
  check (prod_modus is null or prod_modus in ('story', 'film'));
