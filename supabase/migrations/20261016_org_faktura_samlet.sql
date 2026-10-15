-- 2026-10-16: Kontoret velger om Leverandøren fakturerer hvert Medlem for seg
-- eller Kontoret samlet (avtalen punkt 4). Kontor-abonnement faktureres
-- alltid kontoret; dette gjelder enkeltboliger og produksjoner.
alter table public.organizations
  add column if not exists faktura_samlet boolean not null default false;
