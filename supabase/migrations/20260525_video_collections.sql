-- video_collections: named folders for grouping videos
create table if not exists public.video_collections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now()
);

alter table public.video_collections enable row level security;

create policy "Users manage own collections"
  on public.video_collections
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Add collection_id to property_videos
alter table public.property_videos
  add column if not exists collection_id uuid references public.video_collections(id) on delete set null;
