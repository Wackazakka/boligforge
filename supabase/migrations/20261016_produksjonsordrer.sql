-- 2026-10-16: «Bestill produksjon» (avtalen punkt 6 + Vedlegg 3). Megleren
-- bestiller fra boligsiden; vi får en ordrekø i admin. Betaling: saldo fra
-- «Vi produserer»-abonnement, Stripe (når BETALING_AAPEN) eller faktura.
-- Opplåsing av boligen skjer ved bestilling (source 'production').

create table if not exists public.produksjonsordrer (
  id               uuid primary key default gen_random_uuid(),
  property_id      uuid not null references public.properties(id) on delete cascade,
  organization_id  uuid references public.organizations(id) on delete set null,
  user_id          uuid not null,
  nivaa            text not null check (nivaa in ('story', 'film')),
  stil             text not null default 'noytral' check (stil in ('noytral', 'luksus', 'familie', 'nyetablert')),
  maa_med          text,
  ikke_nevn        text,
  pris_visning     text,
  presentasjon     text not null default 'uten' check (presentasjon in ('egen', 'ai', 'uten')),
  publisering      text not null default 'filer' check (publisering in ('reelhome', 'filer')),
  kanaler          text[] not null default '{}',
  tidspunkt        text not null default 'straks' check (tidspunkt in ('straks', 'dato', 'serie')),
  tidspunkt_dato   timestamptz,
  hjem_plakat      boolean not null default true,
  frist            date,
  bilder_maa_med   text[] not null default '{}',
  bilder_ikke_bruk text[] not null default '{}',
  pris_nok         integer not null default 0,
  rabatt_prosent   integer not null default 0,
  betaling         text not null default 'faktura' check (betaling in ('saldo', 'stripe', 'faktura')),
  betalt_at        timestamptz,
  entitlement_id   uuid references public.bolig_entitlements(id) on delete set null,
  stripe_session_id text,
  status           text not null default 'mottatt' check (status in ('mottatt', 'under_arbeid', 'til_godkjenning', 'godkjent', 'publisert', 'avbrutt')),
  notat_intern     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists produksjonsordrer_user_idx on public.produksjonsordrer (user_id, created_at);
create index if not exists produksjonsordrer_status_idx on public.produksjonsordrer (status, created_at);
create index if not exists produksjonsordrer_property_idx on public.produksjonsordrer (property_id);

revoke all on public.produksjonsordrer from anon, authenticated;
alter table public.produksjonsordrer enable row level security;
