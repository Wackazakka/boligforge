-- ReelHome egen publiserings-historikk.
-- BAKGRUNN: `publications`-tabellen ble opprettet av ContentForge med CF-skjema
-- (product_id/draft_id/content_type). ReelHomes egen migrasjon for `publications`
-- ble en no-op (create table if not exists → tabellen fantes alt), så ReelHomes
-- insert (med connection_id/error) feilet stille → publiseringer + feil ble aldri
-- logget, og kalender-historikken var tom. Denne tabellen er ReelHome-eid og
-- prefikset reelhome_ for å ikke kollidere i det delte Supabase-prosjektet.

create table if not exists public.reelhome_publications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  property_id   uuid references public.properties(id) on delete set null,
  connection_id uuid references public.social_connections(id) on delete set null,
  platform      text not null,
  page_name     text,
  caption       text,
  video_url     text,
  post_id       text,
  status        text not null default 'published',  -- 'published' | 'failed'
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_reelhome_publications_user
  on public.reelhome_publications (user_id, created_at desc);

alter table public.reelhome_publications enable row level security;

drop policy if exists "own reelhome publications" on public.reelhome_publications;
create policy "own reelhome publications" on public.reelhome_publications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
