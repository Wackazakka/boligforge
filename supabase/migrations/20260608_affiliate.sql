-- ReelHome affiliate / seller-commission system.
-- Tables are reelhome_*-prefixed because this Supabase project is SHARED with ContentForge.
-- Attribution lives on the ORG (the paying customer) in a dedicated table so the shared
-- organizations table is not touched.

create table if not exists reelhome_sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  ref_code text unique not null,
  commission_rate numeric not null default 0.25,   -- legacy/mirror of rate_y1
  rate_y1 numeric not null default 0.25,            -- provisjon år 1 (per kunde/org, fra org-opprettelse)
  rate_y2 numeric not null default 0.25,
  rate_y3 numeric not null default 0.25,
  rate_y4 numeric not null default 0.25,            -- år 4 og for alltid
  discount_rate numeric not null default 0.25,      -- rabatt rabatt-lenken gir (på abonnement)
  parent_id uuid references reelhome_sellers(id) on delete set null,  -- rekruttert av / sjef
  manager_rate numeric,                             -- flat sjef-sats (null = ikke sjef)
  portal_token text unique not null,                -- selger-portal-token
  recruit_token text,                               -- rekrutteringslenke-token
  active boolean not null default true,
  created_at timestamptz default now()
);
create unique index if not exists reelhome_sellers_recruit_token_key on reelhome_sellers (recruit_token);

-- Attribusjon per org (org-en er kunden). Holdt adskilt fra den delte organizations-tabellen.
create table if not exists reelhome_org_referrals (
  org_id uuid primary key,
  seller_ref text,
  discount_rate numeric,                            -- rabatt-berettigelse (satt via rabatt-lenke)
  created_at timestamptz default now()
);
create index if not exists reelhome_org_referrals_seller_ref_idx on reelhome_org_referrals (seller_ref);

-- Betalingslogg per org (skrives av webhooken; idempotent på stripe_event_id).
create table if not exists reelhome_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  stripe_event_id text unique,
  stripe_invoice_id text,
  stripe_customer_id text,
  plan text,
  kind text,                                        -- 'topup' | 'invoice'
  amount numeric not null,                          -- i NOK (fra øre / 100)
  currency text default 'nok',
  period text,                                      -- 'YYYY-MM' (Europe/Oslo)
  created_at timestamptz default now()
);
create index if not exists reelhome_payments_org_idx on reelhome_payments (org_id);
create index if not exists reelhome_payments_period_idx on reelhome_payments (period);

-- Månedlig provisjons-oppsummering (egne salg + override).
create table if not exists reelhome_seller_commissions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references reelhome_sellers(id) on delete cascade,
  period text not null,
  gross_amount numeric not null default 0,
  commission_amount numeric not null default 0,
  own_commission numeric not null default 0,
  override_commission numeric not null default 0,
  customer_count int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (seller_id, period)
);

-- RLS: kun service_role (tilgang skjer via service-role-klienten i API-rutene).
alter table reelhome_sellers enable row level security;
alter table reelhome_org_referrals enable row level security;
alter table reelhome_payments enable row level security;
alter table reelhome_seller_commissions enable row level security;
drop policy if exists "service role all" on reelhome_sellers;
drop policy if exists "service role all" on reelhome_org_referrals;
drop policy if exists "service role all" on reelhome_payments;
drop policy if exists "service role all" on reelhome_seller_commissions;
create policy "service role all" on reelhome_sellers            for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all" on reelhome_org_referrals      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all" on reelhome_payments           for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role all" on reelhome_seller_commissions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
