-- 2026-10-16: Hjem.no-inngangen (avtalen punkt 4 + 8). Megleren limer inn sin
-- egen hjem.no-annonse; vi kjenner igjen kontor (agency.external_id) og megler
-- (contacts[]) fra annonsen og sender innloggingslenke til e-posten som står
-- der. Kontoret opprettes av FØRSTE megler fra kontoret; senere meglere fra
-- samme kontor knyttes til det via hjem_agency_id.

alter table public.organizations
  add column if not exists hjem_agency_id integer;
create unique index if not exists organizations_hjem_agency_id_key
  on public.organizations (hjem_agency_id) where hjem_agency_id is not null;

-- Logg over utsendte lenker, for å begrense hvor ofte én adresse kan få lenke
-- (hvem som helst kan lime inn en annonse; mottakeren er alltid e-posten i
-- annonsen, men vi vil ikke være en spam-kanal mot meglere).
create table if not exists public.hjem_inngang_logg (
  id           uuid primary key default gen_random_uuid(),
  listing_hash text not null,
  email        text not null,
  user_exists  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists hjem_inngang_logg_email_idx on public.hjem_inngang_logg (email, created_at);

revoke all on public.hjem_inngang_logg from anon, authenticated;
alter table public.hjem_inngang_logg enable row level security;
