-- ReelHome egen planlagt-publiserings-kø.
-- BAKGRUNN: `scheduled_publications` er DELT med ContentForge, og CF sin cron gjør
-- `select('*').lte('scheduled_at', now)` UTEN produkt-filter → den plukker opp ReelHomes
-- ventende rader, klarer ikke å behandle dem (forventer CF-kolonner) og SLETTER dem.
-- Resultat: ReelHomes planlagte poster forsvant før ReelHomes egen cron rakk dem.
-- Egen ReelHome-tabell isolerer køene fysisk.

create table if not exists public.reelhome_scheduled_publications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  property_id    uuid references public.properties(id) on delete cascade,
  video_url      text not null,
  caption        text,
  connection_ids uuid[] not null default '{}',
  scheduled_at   timestamptz not null,
  status         text not null default 'pending',   -- 'pending' | 'published' | 'failed'
  error_message  text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_reelhome_sched_user
  on public.reelhome_scheduled_publications (user_id);
create index if not exists idx_reelhome_sched_due
  on public.reelhome_scheduled_publications (scheduled_at) where status = 'pending';

alter table public.reelhome_scheduled_publications enable row level security;

drop policy if exists "own reelhome scheduled" on public.reelhome_scheduled_publications;
create policy "own reelhome scheduled" on public.reelhome_scheduled_publications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
