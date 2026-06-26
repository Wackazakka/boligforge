-- ReelHome — minutt-måling av avatar-sesjoner (grunnlag for per-minutt-fakturering).
-- Anonyme kjøpere/besøkende treffer den offentlige visningssiden, så denne tabellen
-- følger samme mønster som resten: RLS aktivert UTEN policy → kun service-role
-- (via token-/service-gatede API-ruter) skriver og leser. Megler (eier) utledes
-- server-side fra eiendommen ved sesjonsstart, slik at vi vet hvem som faktureres.

create table if not exists reelhome_avatar_usage (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid references public.properties(id) on delete set null,
  user_id          uuid references auth.users(id) on delete set null,   -- megler som faktureres
  provider         text not null check (provider in ('liveavatar','did')),
  visitor_session  text,                                                -- klient-generert id (gruppering)
  started_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists reelhome_avatar_usage_user_idx
  on reelhome_avatar_usage (user_id, started_at);
create index if not exists reelhome_avatar_usage_property_idx
  on reelhome_avatar_usage (property_id, started_at);

alter table reelhome_avatar_usage enable row level security;
-- Ingen policy: kun service-role får tilgang (anonyme besøkende skriver via API-ruter).
