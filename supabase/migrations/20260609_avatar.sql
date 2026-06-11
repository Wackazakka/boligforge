-- ReelHome Avatar (fase 2) — kunnskapsbase + live avatar-sesjoner.
-- Tabeller er reelhome_avatar_*-prefikset fordi dette Supabase-prosjektet er DELT med ContentForge.
-- Megler-eide tabeller: RLS på user_id = auth.uid().
-- Kjøper-/sesjonstrafikk: RLS aktivert UTEN policy → kun service-role (i token-gatede API-ruter) får tilgang.
-- Bygger på eksisterende tabeller: properties(id, user_id), agent_profiles(user_id), auth.users.

create extension if not exists vector;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Personlig HeyGen-avatar på meglerprofilen (valgfritt, additivt)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.agent_profiles
  add column if not exists liveavatar_avatar_id text,  -- LiveAvatar avatar_id (api.liveavatar.com)
  add column if not exists liveavatar_voice_id  text,  -- LiveAvatar voice (kan speile cloned_voice_id)
  add column if not exists avatar_kind          text default 'template'
    check (avatar_kind in ('template','photo','video'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Opplastede dokumenter per eiendom (megler-eid)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists reelhome_avatar_documents (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('prospekt','tilstandsrapport','vedlegg','energiattest','annet')),
  filename     text not null,
  storage_path text not null,              -- bucket avatar-docs/<property_id>/<uuid>.pdf
  status       text not null default 'pending' check (status in ('pending','processing','ready','failed')),
  error        text,
  pages        int,
  created_at   timestamptz not null default now()
);
create index if not exists idx_avatar_docs_property on reelhome_avatar_documents(property_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. pgvector-chunks (kunnskapsbasen, service-role)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists reelhome_avatar_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references reelhome_avatar_documents(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  kind        text not null,              -- arvet fra dokumentet (kilde-filtrering)
  page        int,
  content     text not null,
  embedding   vector(1536) not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_avatar_chunks_property on reelhome_avatar_chunks(property_id);
create index if not exists idx_avatar_chunks_embedding
  on reelhome_avatar_chunks using hnsw (embedding vector_cosine_ops);

-- RAG-søk (kalles med service-role fra ask-ruten)
create or replace function match_avatar_chunks(
  p_property_id uuid, query_embedding vector(1536), match_count int default 6
) returns table (id uuid, content text, kind text, page int, similarity float)
language sql stable as $$
  select c.id, c.content, c.kind, c.page,
         1 - (c.embedding <=> query_embedding) as similarity
  from reelhome_avatar_chunks c
  where c.property_id = p_property_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Per-eiendom avatar-config (megler-eid) — grensene fra spec tabell 1
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists reelhome_avatar_config (
  property_id            uuid primary key references public.properties(id) on delete cascade,
  user_id                uuid not null references auth.users(id) on delete cascade,
  enabled                boolean not null default false,
  max_session_minutes    int not null default 15,   -- 5/10/15/20
  max_sessions_per_buyer int not null default 2,     -- 1–5
  max_buyers             int,                         -- null = ubegrenset (ev. 10)
  token_expiry_hours     int not null default 48,     -- 24/48/72 (etter visningsdato)
  viewing_date           date,                         -- basis for token-utløp
  max_parallel           int not null default 3,       -- 1–10
  max_total_sessions     int,                           -- null = ubegrenset
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Visningspåmelding = token-gate (kjøper; skrives via service-role)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists reelhome_viewing_signups (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  token         text unique not null default encode(gen_random_bytes(24),'hex'),
  buyer_name    text,
  buyer_email   text,
  buyer_phone   text,
  consent_at    timestamptz,               -- GDPR-samtykke ved påmelding (påkrevd før sesjon)
  auth_user_id  uuid references auth.users(id) on delete set null,
  expires_at    timestamptz not null,       -- viewing_date + token_expiry_hours
  sessions_used int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_viewing_signups_property on reelhome_viewing_signups(property_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Avatar-sesjoner (kjøper; service-role)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists reelhome_avatar_sessions (
  id                uuid primary key default gen_random_uuid(),
  signup_id              uuid not null references reelhome_viewing_signups(id) on delete cascade,
  property_id            uuid not null references public.properties(id) on delete cascade,
  liveavatar_session_id  text,
  status            text not null default 'active' check (status in ('active','ended','expired')),
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  duration_sec      int,
  cost_estimate_nok numeric,               -- akkumulert estimat (kostnadstak)
  created_at        timestamptz not null default now()
);
create index if not exists idx_avatar_sessions_property on reelhome_avatar_sessions(property_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Samtalelogg (kjøper; service-role)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists reelhome_avatar_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references reelhome_avatar_sessions(id) on delete cascade,
  role       text not null check (role in ('buyer','avatar')),
  content    text not null,
  chunk_refs uuid[],                        -- chunks svaret hvilte på (sporbarhet/anti-hallusinering)
  created_at timestamptz not null default now()
);
create index if not exists idx_avatar_messages_session on reelhome_avatar_messages(session_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Kjøpersammendrag (fase 2 — megler-eid)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists reelhome_buyer_summaries (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references reelhome_avatar_sessions(id) on delete cascade,
  property_id       uuid not null references public.properties(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,  -- megler (mottaker)
  buyer_name        text,
  buyer_contact     text,
  duration_sec      int,
  categories        jsonb,                  -- {teknisk:[...], økonomi:[...], nabolag:[...], praktisk:[...]}
  concerns          text[],
  priorities        text[],
  interest_score    int check (interest_score between 1 and 5),
  recommended_focus text,
  emailed_at        timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_buyer_summaries_property on reelhome_buyer_summaries(property_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RLS
--    Megler-eide tabeller: eier ser kun egne rader. (Service-role bypasser uansett.)
--    Kjøper-/sesjonstabeller: RLS PÅ uten policy → kun service-role i token-gatede ruter.
-- ─────────────────────────────────────────────────────────────────────────────
alter table reelhome_avatar_documents enable row level security;
alter table reelhome_avatar_config    enable row level security;
alter table reelhome_viewing_signups  enable row level security;
alter table reelhome_buyer_summaries  enable row level security;

drop policy if exists "avatar_docs: own"     on reelhome_avatar_documents;
drop policy if exists "avatar_config: own"   on reelhome_avatar_config;
drop policy if exists "viewing_signups: own" on reelhome_viewing_signups;
drop policy if exists "buyer_summaries: own" on reelhome_buyer_summaries;

create policy "avatar_docs: own"     on reelhome_avatar_documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "avatar_config: own"   on reelhome_avatar_config
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "viewing_signups: own" on reelhome_viewing_signups
  for all using (
    property_id in (select id from public.properties where user_id = auth.uid())
  );
create policy "buyer_summaries: own" on reelhome_buyer_summaries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Kjøper-/sesjonstabeller: RLS på, ingen policy (service-role only).
alter table reelhome_avatar_chunks   enable row level security;
alter table reelhome_avatar_sessions enable row level security;
alter table reelhome_avatar_messages enable row level security;
