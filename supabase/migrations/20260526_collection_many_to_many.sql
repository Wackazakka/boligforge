-- 1. Add org_id to video_collections (org-level shared folders)
alter table public.video_collections
  add column if not exists org_id uuid references public.organizations(id) on delete cascade;

-- user_id = personal folder (only creator sees it)
-- org_id  = org-level folder (all org members see it, created by admin)
-- Exactly one of user_id / org_id should be set

-- 2. Many-to-many join table
create table if not exists public.collection_videos (
  collection_id uuid not null references public.video_collections(id) on delete cascade,
  video_id      uuid not null references public.property_videos(id)   on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (collection_id, video_id)
);

alter table public.collection_videos enable row level security;

-- Anyone who can see the collection can read its videos
create policy "collection_videos read"
  on public.collection_videos for select
  using (true);

-- Users can add/remove from their own collections (enforced in API)
create policy "collection_videos write"
  on public.collection_videos for all
  using (true)
  with check (true);

-- 3. Migrate existing single-assignment data to join table
insert into public.collection_videos (collection_id, video_id)
select collection_id, id
from   public.property_videos
where  collection_id is not null
on conflict do nothing;

-- 4. Drop old FK column (no longer needed)
alter table public.property_videos drop column if exists collection_id;
