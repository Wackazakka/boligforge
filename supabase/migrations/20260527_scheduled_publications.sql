-- Scheduled & published social-media posts for the calendar feature
-- Mirrors the ContentForge scheduling model, adapted to BoligForge's
-- property-video flow (video_url + connection_ids instead of drafts).

-- ============================================================================
-- scheduled_publications: posts queued for future publishing (picked up by cron)
-- ============================================================================
create table if not exists public.scheduled_publications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  property_id    uuid references public.properties(id) on delete cascade,
  video_url      text not null,
  caption        text,
  connection_ids uuid[] not null default '{}',
  scheduled_at   timestamptz not null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_scheduled_publications_user
  on public.scheduled_publications(user_id);
create index if not exists idx_scheduled_publications_due
  on public.scheduled_publications(scheduled_at);

alter table public.scheduled_publications enable row level security;

create policy "Users manage own scheduled publications"
  on public.scheduled_publications
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- publications: log of posts that were actually published (history + calendar)
-- ============================================================================
create table if not exists public.publications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  property_id   uuid references public.properties(id) on delete set null,
  connection_id uuid references public.social_connections(id) on delete set null,
  platform      text not null,
  page_name     text,
  caption       text,
  video_url     text,
  post_id       text,
  status        text not null default 'published',
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_publications_user
  on public.publications(user_id);

alter table public.publications enable row level security;

create policy "Users view own publications"
  on public.publications
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
