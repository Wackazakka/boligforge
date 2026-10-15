-- 2026-10-16: Fra «videoer per måned» til «boliger».
--
-- Avtalen med hjem.no (15/10) selger per BOLIG: en bolig låses opp én gang
-- (første bolig gratis, fra abonnementssaldo, eller enkeltkjøp), og deretter
-- er alle formater og regenereringer på den boligen fri. Abonnementene gir et
-- antall boliger i måneden som overføres til neste måned («Lag selv») eller
-- én måned («Vi produserer»). Dette erstatter video_credits (per video, per
-- bruker), som ikke lenger leses av noe etter denne endringen. Tabellen
-- beholdes med historikk og kan droppes senere.
--
-- Alle tre tabellene leses og skrives KUN via service_role fra API-rutene.
-- Nye tabeller arver prosjektets anon/authenticated-GRANT (ALTER DEFAULT
-- PRIVILEGES), så rettighetene trekkes eksplisitt og RLS slås på uten
-- policyer (deny-all) — to lag, som i RLS-sveipet 25/8.

-- Kontorets abonnementer (ett per type/nivå). user_id satt = megler-nivå
-- («Medlem»), null = deles av hele kontoret («Kontor»).
create table if not exists public.bolig_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  user_id                uuid,
  kind                   text not null check (kind in ('lag_selv', 'vi_produserer')),
  scope                  text not null check (scope in ('medlem', 'kontor')),
  boliger_per_month      integer not null check (boliger_per_month > 0),
  price_nok_month        integer not null,
  status                 text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  stripe_subscription_id text unique,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists bolig_subscriptions_org_idx on public.bolig_subscriptions (organization_id, status);

-- Saldo-poster: boliger som kan låses opp. Fylles per abonnementsperiode
-- (webhook/invoice.paid), ved kjøp, eller manuelt av oss. remaining trekkes
-- ned per opplåsing. expires_at = utgangen av NESTE måned for abonnement
-- («ubrukte boliger overføres til neste måned»); null = utløper ikke.
create table if not exists public.bolig_entitlements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid,
  kind            text not null check (kind in ('lag_selv', 'vi_produserer')),
  quantity        integer not null check (quantity > 0),
  remaining       integer not null check (remaining >= 0),
  source          text not null check (source in ('subscription', 'purchase', 'admin')),
  subscription_id uuid references public.bolig_subscriptions(id) on delete set null,
  period_start    date,
  expires_at      timestamptz,
  note            text,
  created_at      timestamptz not null default now()
);
create index if not exists bolig_entitlements_org_idx on public.bolig_entitlements (organization_id, kind, remaining);

-- Én rad per opplåst bolig. Finnes raden, er alle formater og regenereringer
-- på boligen fri. source sier hvordan den ble betalt.
create table if not exists public.property_unlocks (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null unique references public.properties(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  user_id         uuid not null,
  source          text not null check (source in ('free_first', 'entitlement', 'purchase', 'production', 'admin')),
  entitlement_id  uuid references public.bolig_entitlements(id) on delete set null,
  price_nok       integer not null default 0,
  stripe_session_id text,
  created_at      timestamptz not null default now()
);
create index if not exists property_unlocks_user_idx on public.property_unlocks (user_id, created_at);
create index if not exists property_unlocks_org_idx  on public.property_unlocks (organization_id, created_at);
-- «Første bolig gratis» håndheves i databasen: bare én gratis per megler,
-- også om to genereringer starter samtidig.
create unique index if not exists property_unlocks_one_free_per_user
  on public.property_unlocks (user_id) where source = 'free_first';

-- Boliger har til nå bare hatt user_id. Kontoret trenger oversikt over sine
-- boliger (avtalen punkt 4), så organization_id legges på og fylles fra
-- medlemskapet. Settes også ved opplåsing.
alter table public.properties
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;
update public.properties p
   set organization_id = m.organization_id
  from public.organization_members m
 where m.user_id = p.user_id
   and p.organization_id is null;
create index if not exists properties_org_idx on public.properties (organization_id);

-- Kun service_role.
revoke all on public.bolig_subscriptions from anon, authenticated;
revoke all on public.bolig_entitlements  from anon, authenticated;
revoke all on public.property_unlocks     from anon, authenticated;
alter table public.bolig_subscriptions enable row level security;
alter table public.bolig_entitlements  enable row level security;
alter table public.property_unlocks     enable row level security;
