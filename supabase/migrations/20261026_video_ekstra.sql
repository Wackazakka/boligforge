-- 2026-10-26: Videoer utover det inkluderte antallet per bolig (avtalen pkt 5,
-- rev 80): inntil 15 videoer per bolig er inkludert i prisen, medregnet
-- versjoner laget før nedlasting. Hver video utover det belastes 40 kr.
-- Én rad per ekstra video, skrevet av /api/video/generate når boligen er tatt
-- i bruk og tellingen passerer taket. Fakturaunderlaget tar radene med.
-- Kun service_role leser/skriver.

create table if not exists public.video_ekstra (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties(id) on delete cascade,
  user_id         uuid not null,
  organization_id uuid references public.organizations(id) on delete set null,
  job_id          text,
  nummer          integer not null,           -- videoens løpenummer på boligen (16, 17, …)
  price_nok       integer not null default 40,
  created_at      timestamptz not null default now()
);
create index if not exists video_ekstra_user_created_idx on public.video_ekstra (user_id, created_at);
create index if not exists video_ekstra_property_idx on public.video_ekstra (property_id);

alter table public.video_ekstra enable row level security;
revoke all on public.video_ekstra from anon, authenticated;
