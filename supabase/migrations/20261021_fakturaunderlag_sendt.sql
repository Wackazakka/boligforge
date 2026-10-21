-- 2026-10-21: Logg over utsendte fakturaunderlag (automatisk e-post den
-- første i måneden, /api/cron/fakturaunderlag). Én rad per organisasjon og
-- måned gjør kjøringen idempotent: kjøres cronen to ganger, sendes ikke
-- underlaget på nytt (med mindre ?force=1). Kun service_role leser/skriver.

create table if not exists public.fakturaunderlag_sendt (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  maaned          text not null check (maaned ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  antall          integer not null default 0,
  sum_nok         integer not null default 0,
  mottakere       text[] not null default '{}',
  resend_id       text,
  sent_at         timestamptz not null default now(),
  unique (organization_id, maaned)
);

alter table public.fakturaunderlag_sendt enable row level security;
revoke all on public.fakturaunderlag_sendt from anon, authenticated;
