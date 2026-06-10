> ## ✅ FASE 0 FULLFØRT — planen er delvis erstattet (2026-06-10)
> PoC-en besvarte alle risikospørsmålene. **Les `avatar-fase0-funn.md` sammen med denne planen** — den overstyrer på følgende punkter:
>
> 1. **§5.1 HeyGen → LiveAvatar:** Det gamle HeyGen Streaming-API-et er dødt. Alt bruker nå `api.liveavatar.com` + `@heygen/liveavatar-web-sdk` (mode FULL, `repeat()`, `voiceChat.start()` + `startListening()`). Env: `LIVEAVATAR_API_KEY`.
> 2. **§5.2 Whisper UTGÅR:** LiveAvatar har innebygd STT som virker på norsk (`language: 'no'` i avatar_persona — kritisk; 'en' feiltolker norsk). `USER_TRANSCRIPTION`-events erstatter hele Whisper-steget i dataflyten (§2.2).
> 3. **Latency verifisert:** tale-latency 0,6–1,1 s konsistent (mål <2 s) — grønt lys. STREAM_READY 2,3–7,6 s → bruk «kobler til megler…»-spinner.
> 4. **Fundament KJØRT (2026-06-10):** migrasjonen (`20260609_avatar.sql`) er kjørt mot ReelHome-prosjektet (eget prosjekt etter CF-separasjonen) — 7 tabeller + pgvector + `match_avatar_chunks` + RLS på plass. Storage-bucket `avatar-docs` (privat) opprettet.
> 5. **PoC-kode:** `app/avatar-poc/page.tsx` + `app/api/avatar/poc-token/route.ts` på branch `feat/avatar-fase0` (ikke merget — token-ruten må gates før evt. merge, ellers kan hvem som helst brenne LiveAvatar-kreditter).
>
> **Status: klar for Fase 1 (MVP).**

# ReelHome Avatar — Teknisk Spec (fase 2)

**Versjon:** plan v1.0 · **Dato:** 2026-06-09 · **Repo:** `~/boligforge` (Next.js 16.2.6, Netlify) · **Supabase:** `jvnavubholyvihvytqkn` (delt med ContentForge) · **Forfatter-rolle:** arkitekt (read-only plan)

> Denne planen er forankret i faktisk kode. Sentrale mønstre den bygger på:
> - **SDK lazy-init:** alle eksterne klienter konstrueres i en `getX()`-funksjon, aldri på modulnivå (jf. `getClient()` i `properties/generate-script`, `getStripe()`, `getResend()`). Påkrevd ellers krasjer Netlify-bygget når nøkkel mangler build-time.
> - **To Supabase-klienter:** `createSupabaseServerClient()`/`getUser()` (RLS, innlogget megler) vs. service-role `createClient(...SERVICE_ROLE_KEY)` (cron/webhooks/offentlige token-ruter). Jf. `lib/supabase/server.ts`.
> - **Delt prosjekt → prefiks-tabeller:** nye tabeller får `reelhome_`-prefiks (jf. `reelhome_sellers`, `reelhome_payments`) for å ikke kollidere med ContentForge.
> - **Droplet `139.59.212.218`** kjører allerede scraper-tjeneste (port 3003) som re-hoster bilder til R2 og skriver til Supabase. Tung/langvarig prosessering hører hjemme her, ikke i Netlify-funksjoner.
> - **Offentlige Netlify-ruter** gates med hemmelig header/token (jf. `CRON_SECRET`, `SUPABASE_WEBHOOK_SECRET`, `ADMIN_SECRET`).
> - **`OPENAI_API_KEY` + `ELEVENLABS_API_KEY` finnes allerede** i env. **HeyGen-nøkkel mangler** og må legges til.

---

## 1. Sammendrag

ReelHome Avatar lar en kjøper påmeldt visning føre en muntlig videodialog med en AI-avatar som kun svarer ut fra eiendommens dokumenter (prospekt, tilstandsrapport, vedlegg). Flyt: **kjøper taler → Whisper (STT) → pgvector-RAG over eiendomens kunnskapsbase → Claude genererer svar → HeyGen Live Avatar leser opp**. Alt logges; etter sesjon genererer Claude et strukturert kjøpersammendrag med interesse-score som sendes megler via Resend + dashboard.

Tilgang gates av visningspåmelding (Supabase Auth magic-link → token). Megler konfigurerer grenser per eiendom (samtalelengde, sesjoner, antall kjøpere, token-utløp, parallellitet) og ser kostnadstak. Billing kobles på eksisterende Stripe (per-eiendom kr 399/mnd, bundle kr 599, evt. per-samtale prøvemodell).

Arkitekturen gjenbruker alt eksisterende: samme dashboard-shell, samme route-mønstre, samme droplet for tung prosessering, samme Stripe/Resend/Anthropic-oppsett. Det eneste genuint nye eksternt er **HeyGen** (krever PoC for latency) og **pgvector** (krever extension + ny tabell).

---

## 2. Arkitektur (med dataflyt)

### 2.1 Megler-side: PDF → kunnskapsbase (offline, asynkron)

```
Megler (dashboard/properties/[id])
  │  laster opp PDF (prospekt / tilstandsrapport / vedlegg)
  ▼
POST /api/avatar/documents/upload   (Netlify, getUser, RLS)
  │  - validerer eierskap (properties.user_id = user.id)
  │  - laster PDF til Supabase Storage bucket `avatar-docs`
  │  - inserter reelhome_avatar_documents (status=pending)
  │  - kaller droplet for tung prosessering ↓ (fire-and-forget)
  ▼
DROPLET 139.59.212.218 : ny tjeneste port 3004  (PDF-pipeline)
  │  1. last ned PDF fra Storage
  │  2. ekstraher tekst (pdf-parse / pdfminer) + sidetall
  │  3. semantisk chunking (~800–1000 tokens, 15% overlap, respekter seksjoner)
  │  4. klassifiser chunk-kilde (tilstandsrapport/prospekt/vedlegg/energiattest)
  │  5. embeddings: OpenAI text-embedding-3-small (1536 dim)
  │  6. INSERT reelhome_avatar_chunks (vector) via service-role
  │  7. oppdater reelhome_avatar_documents.status = ready
  ▼
Kunnskapsbase klar for RAG
```

Hvorfor droplet og ikke Netlify-funksjon: PDF-parsing + chunking + embeddings av en 100-siders tilstandsrapport overstiger Netlify-funksjonens praktiske tid/minne, og dropleten har allerede mønsteret (scraper port 3003 gjør nøyaktig dette: tung jobb → R2/Supabase). Vi legger en ny tjeneste på **port 3004** ved siden av.

### 2.2 Kjøper-side: live dialog (online, lav-latency)

```
Kjøper åpner /avatar/[token]   (offentlig side, ingen dashboard-auth)
  │
  ▼ token valideres  → GET /api/avatar/session/init?token=...
  │   - service-role: slå opp reelhome_viewing_signups (token, utløp, grenser)
  │   - sjekk: ikke utløpt, sesjoner < maks, parallelle < maks
  │   - opprett reelhome_avatar_sessions (status=active, started_at)
  │   - be HeyGen om streaming-session-token  → returner til klient
  ▼
Klient (React, /avatar/[token]):
  - HeyGen Streaming Avatar SDK (WebRTC video i <video>)
  - mikrofon → lyd-chunks
  │
  ├─ tale ──► POST /api/avatar/transcribe  (Whisper)  ──► tekst
  │
  └─ tekst ─► POST /api/avatar/ask
                │  1. embed spørsmål (OpenAI)
                │  2. pgvector match_avatar_chunks(property_id, embedding, k=6)
                │  3. Claude (Sonnet) m/ retrieved chunks + system-guardrails
                │  4. logg reelhome_avatar_messages (Q + A + chunk-refs)
                │  5. returnér svartekst (streaming)
                ▼
            Klient sender svartekst → HeyGen.speak(text) → avatar leser opp
  │
  ▼ sesjon avsluttes (15 min timeout / kjøper lukker / visningsdato+48t)
POST /api/avatar/session/end → status=ended → trigger sammendrag (fase 2)
```

**Latency-betraktning (åpent spørsmål 1):** kritisk sti er `Whisper → embed → pgvector → Claude → HeyGen.speak`. For naturlig dialog (<2–3 s opplevd):
- Bruk **`claude-sonnet-4-x`** (ikke Opus) for svar — raskere, billig nok, RAG-grounded svar trenger ikke Opus' resonnement.
- **Stream** Claude-svaret og send til HeyGen i setninger (split på `. ` / `? `) i stedet for å vente på hele svaret.
- Whisper: send lyd i ferdige ytringer (VAD-grenset), ikke kontinuerlig.
- pgvector: IVFFlat/HNSW-indeks, k=6, kun innen `property_id` (liten partisjon).
- HeyGen Live Avatar tale-start-latency er den ukjente — **PoC først** (se §5).

### 2.3 Hvor ting kjører

| Steg | Kjøres på | Begrunnelse |
|---|---|---|
| PDF → chunks → embeddings | Droplet :3004 | Tungt/langvarig, har R2+Supabase-tilgang |
| Token-validering, sesjon-init | Netlify route (service-role) | Rask, gates offentlig |
| Whisper STT | Netlify route | Kort request, proxy til OpenAI |
| RAG-søk + Claude-svar | Netlify route | Kort, streaming |
| HeyGen streaming | Klient (browser WebRTC) + Netlify for session-token | SDK kjører i browser |
| Sammendrag (Claude) | Netlify route, trigget av session/end eller cron | Asynkront, ikke latency-kritisk |

---

## 3. Datamodell

Ny migrasjon: `supabase/migrations/20260610_avatar.sql`. Alt prefikset `reelhome_*`. Følg idempotent stil (`create table if not exists`, `drop policy if exists`). `properties` er scopet på `user_id` (ikke org) — gjenbruk den konvensjonen.

```sql
create extension if not exists vector;

-- 3.1 avatar_id på meglerprofil (personlig HeyGen-avatar).
-- agent_profiles finnes allerede (remote). Legg til kolonner additivt:
alter table public.agent_profiles
  add column if not exists heygen_avatar_id  text,   -- HeyGen Photo/Video Avatar id
  add column if not exists heygen_voice_id   text,   -- HeyGen voice (kan gjenbruke ElevenLabs-stemme via HeyGen)
  add column if not exists avatar_kind        text default 'template'  -- 'template'|'photo'|'video'
    check (avatar_kind in ('template','photo','video'));

-- 3.2 Opplastede dokumenter per eiendom
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

-- 3.3 pgvector chunks (kunnskapsbasen)
create table if not exists reelhome_avatar_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references reelhome_avatar_documents(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  kind        text not null,              -- arvet fra dokumentet (for kilde-filtrering)
  page        int,
  content     text not null,
  embedding   vector(1536) not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_avatar_chunks_property on reelhome_avatar_chunks(property_id);
create index if not exists idx_avatar_chunks_embedding
  on reelhome_avatar_chunks using hnsw (embedding vector_cosine_ops);

-- RAG-søkefunksjon (kalt med service-role fra ask-ruten)
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

-- 3.4 Per-eiendom avatar-config (grensene i tabell 1)
create table if not exists reelhome_avatar_config (
  property_id          uuid primary key references public.properties(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  enabled              boolean not null default false,
  max_session_minutes  int not null default 15,   -- 5/10/15/20
  max_sessions_per_buyer int not null default 2,  -- 1–5
  max_buyers           int,                        -- null = ubegrenset, ev. 10
  token_expiry_hours   int not null default 48,    -- 24/48/72 (etter visningsdato)
  viewing_date         date,                        -- visningsdato (basis for token-utløp)
  max_parallel         int not null default 3,      -- 1–10
  max_total_sessions   int,                          -- null = ubegrenset
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- 3.5 Visningspåmelding = token-gate (kjøper)
create table if not exists reelhome_viewing_signups (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  token        text unique not null default encode(gen_random_bytes(24),'hex'),
  buyer_name   text,
  buyer_email  text,
  buyer_phone  text,
  consent_at   timestamptz,                -- GDPR-samtykke ved påmelding (påkrevd)
  auth_user_id uuid references auth.users(id) on delete set null, -- ved magic-link
  expires_at   timestamptz not null,        -- viewing_date + token_expiry_hours
  sessions_used int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_viewing_signups_property on reelhome_viewing_signups(property_id);

-- 3.6 Avatar-sesjoner
create table if not exists reelhome_avatar_sessions (
  id            uuid primary key default gen_random_uuid(),
  signup_id     uuid not null references reelhome_viewing_signups(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  heygen_session_id text,
  status        text not null default 'active' check (status in ('active','ended','expired')),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  duration_sec  int,
  cost_estimate_nok numeric,               -- akkumulert estimat for kostnadstak
  created_at    timestamptz not null default now()
);
create index if not exists idx_avatar_sessions_property on reelhome_avatar_sessions(property_id);

-- 3.7 Samtalelogg (Q&A)
create table if not exists reelhome_avatar_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references reelhome_avatar_sessions(id) on delete cascade,
  role        text not null check (role in ('buyer','avatar')),
  content     text not null,
  chunk_refs  uuid[],                       -- hvilke chunks svaret hvilte på (sporbarhet/anti-hallusinering)
  created_at  timestamptz not null default now()
);
create index if not exists idx_avatar_messages_session on reelhome_avatar_messages(session_id);

-- 3.8 Kjøpersammendrag (fase 2)
create table if not exists reelhome_buyer_summaries (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references reelhome_avatar_sessions(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,  -- megler (mottaker)
  buyer_name    text,
  buyer_contact text,
  duration_sec  int,
  categories    jsonb,        -- {teknisk:[...], økonomi:[...], nabolag:[...], praktisk:[...]}
  concerns      text[],
  priorities    text[],
  interest_score int check (interest_score between 1 and 5),
  recommended_focus text,
  emailed_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_buyer_summaries_property on reelhome_buyer_summaries(property_id);
```

### RLS-strategi (følg eksisterende mønstre)

- **Megler-eide tabeller** (`reelhome_avatar_documents`, `reelhome_avatar_config`, `reelhome_viewing_signups`, `reelhome_buyer_summaries`): RLS `using (user_id = auth.uid())` for SELECT/INSERT/UPDATE — samme som `scheduled_publications`.
- **Kjøper-trafikk** (`reelhome_avatar_sessions`, `reelhome_avatar_messages`, `reelhome_avatar_chunks`): kjøperen er **ikke** en innlogget megler. Disse skrives/leses via **service-role i offentlige token-gated ruter** — RLS settes til `service_role`-only (samme mønster som `reelhome_*`-affiliate-tabellene). Token-lenken er sikkerhetsgrensen, ikke RLS.
- `match_avatar_chunks` kalles med service-role; ingen kjøper får direkte tabelltilgang.

---

## 4. Komponenter & API-ruter

Følg `app/api/<domene>/<handling>/route.ts`-mønsteret. Nytt domene: `avatar`.

### Megler-ruter (Netlify, `getUser()` + RLS-klient)
| Rute | Metode | Funksjon |
|---|---|---|
| `app/api/avatar/documents/upload/route.ts` | POST | Last opp PDF → Storage, insert document (pending), trigge droplet :3004 |
| `app/api/avatar/documents/route.ts` | GET/DELETE | List/slett dokumenter for eiendom |
| `app/api/avatar/config/route.ts` | GET/POST | Les/lagre `reelhome_avatar_config` (grensene), `enabled`-toggle |
| `app/api/avatar/signups/route.ts` | GET/POST | Generer påmeldingslenke(r), list påmeldte kjøpere |
| `app/api/avatar/summaries/route.ts` | GET | Megler henter kjøpersammendrag for eiendom/dashboard |
| `app/api/avatar/cost-estimate/route.ts` | GET | Beregn kostnadstak fra config (vises i panelet) |

### Kjøper-ruter (Netlify, **service-role**, gated på `token`)
| Rute | Metode | Funksjon |
|---|---|---|
| `app/api/avatar/signup/route.ts` | POST | Offentlig: kjøper melder seg på visning (navn/e-post/samtykke) → opprett signup + token, ev. send magic-link |
| `app/api/avatar/session/init/route.ts` | POST | Valider token, sjekk grenser, opprett sesjon, hent HeyGen streaming-token |
| `app/api/avatar/transcribe/route.ts` | POST | Whisper STT (proxy OpenAI), gated på aktiv sesjon |
| `app/api/avatar/ask/route.ts` | POST | RAG + Claude, logg melding, stream svar |
| `app/api/avatar/session/end/route.ts` | POST | Avslutt sesjon, beregn varighet/kostnad, trigge sammendrag |

### Intern/cron
| Rute | Funksjon |
|---|---|
| `app/api/avatar/summarize/route.ts` | Gates med `CRON_SECRET`/intern: Claude lager sammendrag → `reelhome_buyer_summaries` → Resend |
| `app/api/cron/avatar-expire/route.ts` | Marker utløpte sesjoner/signups (Netlify scheduler, jf. eksisterende cron-mønster) |

### Frontend
| Side/komponent | Funksjon |
|---|---|
| `app/avatar/[token]/page.tsx` | **Offentlig** kjøper-opplevelse: HeyGen video, mikrofon, dialog. Ligger utenfor `/dashboard`-matcher i `proxy.ts` (ingen megler-auth) |
| `app/avatar/[token]/AvatarClient.tsx` | Klientkomponent: HeyGen Streaming SDK, WebRTC, VAD, kall til transcribe/ask |
| `app/pamelding/[propertyToken]/page.tsx` | Offentlig påmeldingsskjema (navn/e-post/samtykke) → `/api/avatar/signup` |
| `app/dashboard/properties/[id]/` | Ny **Avatar-fane**: dokumentopplasting, config-grenser, kostnadstak, påmeldingslenker, sammendragsliste |
| `app/dashboard/DashboardNav.tsx` | (valgfritt) legg til toppnivå «Avatar»-element, ellers inne i property-detalj |
| `app/onboarding/avatar/page.tsx` | Utvid: valgfri personlig HeyGen Photo/Video-avatar (Alt A/B) |

### Delt bibliotek (`lib/`)
- `lib/avatar/heygen.ts` — `getHeygen()` lazy-klient, `createStreamingSession()`, `createPhotoAvatar()`, `createVideoAvatar()`
- `lib/avatar/rag.ts` — `embed(text)`, `retrieve(propertyId, query, k)`, `buildPrompt(chunks, question)`
- `lib/avatar/cost.ts` — kostnadsmodell (HeyGen/min, Whisper, Claude, pgvector) for kostnadstak-visning
- `lib/avatar/summary-email.ts` — Resend HTML-template (jf. `lib/seller-email.ts`)

---

## 5. Eksterne integrasjoner

### 5.1 HeyGen (krever PoC — viktigste tekniske risiko)
**Må undersøkes før commit:**
1. **Live Avatar latency** (åpent spørsmål 1): tid fra `speak(text)` til avatar starter tale. Mål mot reell norsk tekst. Akseptkriterium: < ~1,5 s tale-start.
2. **Streaming-arkitektur:** HeyGen Streaming Avatar SDK kjører i browser (WebRTC). Netlify-ruten leverer kun en kortlivet session-token (lazy `getHeygen()`); avatar-strømmen går browser↔HeyGen direkte.
3. **Norsk TTS-kvalitet** i HeyGen, evt. ElevenLabs-stemme (vi har allerede `ELEVENLABS_API_KEY` + `cloned_voice_id` på profil) routet gjennom HeyGen.
4. **Personlig avatar (Alt A/B):** Photo Avatar (bilde, enklest) vs. Video Avatar (30–60 s klipp, bedre leppe-synk, anbefalt). Oppretting tar 5–10 min → asynkron jobb i onboarding, lagre `heygen_avatar_id` på `agent_profiles`. Fallback = template-avatar (`avatar_kind='template'`, dagens flyt).

**Ny env:** `HEYGEN_API_KEY` (sett via `netlify env:set --force` så den er lesbar for lokal test; husk at dashboard-satte secrets returnerer tomt via CLI).

### 5.2 Whisper (OpenAI)
`OPENAI_API_KEY` finnes allerede (brukes i `properties/classify-images`). `transcribe`-ruten proxy-er lyd til `whisper-1` med `language: 'no'`. Lazy `getOpenAI()`-klient.

### 5.3 OpenAI embeddings
`text-embedding-3-small` (1536 dim, billig) — samme nøkkel. Brukt både i droplet-pipelinen og i `ask`-ruten (spørsmåls-embedding).

### 5.4 Claude (Anthropic)
`@anthropic-ai/sdk` finnes. Lazy `getClient()`-mønster fra `generate-script`.
- **Svar (RAG):** `claude-sonnet-4-5` — latency-følsom, grounded.
- **Sammendrag:** `claude-sonnet-4-5` (ev. Haiku for kostnad), strukturert JSON-output.
- **System-guardrails (anti-hallusinering + åpent spørsmål 5):** «Svar KUN ut fra vedlagte dokumentutdrag. Hvis informasjon mangler, si det. For TG2/TG3-avvik: beskriv funnet ordrett fra tilstandsrapporten, men gi ALDRI juridisk/teknisk råd om konsekvens eller utbedring — henvis til megler/fagperson.»

---

## 6. Sikkerhet & GDPR

- **Token-gate:** offentlige kjøper-ruter validerer `token` mot `reelhome_viewing_signups` (unik, tilfeldig 24-byte). Sjekk `expires_at` (= `viewing_date + token_expiry_hours`), `sessions_used < max_sessions_per_buyer`, antall aktive sesjoner `< max_parallel`, total `< max_total_sessions`. Magic-link (Supabase Auth) valgfritt for å verifisere kjøperens e-post — kobler `auth_user_id`.
- **Offentlige ruter:** følg plattform-regelen — Netlify-ruter er offentlig nåbare. Kjøper-ruter er bevisst offentlige men token-gated; interne ruter (`summarize`) gates med `CRON_SECRET`/intern hemmelighet.
- **Service-role aldri til klient:** all kjøperskriving går server-side.
- **GDPR (åpent spørsmål 3):**
  - **Samtykke** kreves ved påmelding (`consent_at` må settes; skjema med tydelig personvern-tekst). Ingen samtykke → ingen sesjon.
  - **Lagring:** samtalelogg + kjøper-PII (navn/e-post/telefon) i Supabase. Definer formål (megleroppfølging) og lagringstid.
  - **Sletting:** cron `avatar-expire` kan anonymisere/slette `reelhome_avatar_messages` + kjøper-PII X dager etter visning. `on delete cascade` gjør at sletting av signup/eiendom rydder alt.
  - **Innsyn/dataportabilitet:** megler kan eksportere/slette kjøperdata fra panelet (gjenbruk `agent/export`-mønster).
  - **Databehandleravtaler:** HeyGen/OpenAI/Anthropic prosesserer kjøperdata → må inn i Norditechs DPA-oversikt (organisatorisk, ikke kode).

---

## 7. Billing (Stripe)

Gjenbruk hele oppsettet i `app/api/stripe/` (`getStripe()`, `PRICE_IDS`, webhook).

- **Alt A (anbefalt):** abonnement per aktiv annonse med Avatar. Nye Stripe Price-IDer:
  - `STRIPE_PRICE_AVATAR` (kr 399/mnd)
  - `STRIPE_PRICE_BUNDLE` (video+Avatar kr 599/mnd)
  - Byrå 10+ → `quantity`-basert (samme mønster som dagens `office`-plan).
- **Aktivering:** `reelhome_avatar_config.enabled` settes når abonnement er aktivt; webhook (`customer.subscription.*`) oppdaterer status. Per-eiendom-abonnement → lagre Stripe subscription-item per `property_id` (utvid metadata i checkout, jf. dagens `metadata: { plan, user_id, organization_id }`).
- **Alt B (prøvemodell):** per samtale kr 25 (min 3 min) → engangs-`payment`-checkout eller post-paid teller på `reelhome_avatar_sessions.cost_estimate_nok`.
- **Affiliate:** dagens provisjonssystem (`reelhome_payments`/`reelhome_seller_commissions`) fanger automatisk de nye abonnementene via webhooken — ingen ekstra arbeid utover at nye planer logges i `reelhome_payments`.
- **Kostnadstak-visning:** `lib/avatar/cost.ts` beregner maks-kostnad fra config (f.eks. `max_total_sessions × max_session_minutes × kr/min`), vises i panelet (dok: «maks ca. kr 650»).

---

## 8. Faseplan med oppgaver (avhengigheter i parentes)

### Fase 0 — PoC & fundament (3–5 dager, gjøres FØR MVP-estimat låses)
- T0.1 **HeyGen Live Avatar PoC**: mål latency, norsk TTS, streaming i browser. Beslutt template vs. personlig avatar. *(blokkerer hele kjøper-opplevelsen)*
- T0.2 Skaff `HEYGEN_API_KEY`, sett via `netlify env:set --force`.
- T0.3 Migrasjon `20260610_avatar.sql` (extension vector + alle tabeller/RLS/`match_avatar_chunks`). *(blokkerer alt DB-arbeid)*
- T0.4 Opprett Storage-bucket `avatar-docs`.

### Fase 1 — MVP (4–6 uker)
**Spor A — PDF→kunnskapsbase**
- A1 Droplet-tjeneste :3004: PDF-ekstraksjon + chunking + embeddings + insert. *(T0.3)*
- A2 `POST /api/avatar/documents/upload` + GET/DELETE. *(A1, T0.4)*
- A3 Dashboard Avatar-fane: opplasting + dokumentstatus. *(A2)*

**Spor B — RAG + dialog**
- B1 `lib/avatar/rag.ts` (embed/retrieve/prompt) + guardrails. *(T0.3, A1)*
- B2 `POST /api/avatar/ask` (RAG+Claude streaming, logging). *(B1)*
- B3 `POST /api/avatar/transcribe` (Whisper). *(—)*
- B4 `lib/avatar/heygen.ts` + `POST /api/avatar/session/init` (streaming-token). *(T0.1)*
- B5 `app/avatar/[token]/` klient: HeyGen video + mic + dialog-loop. *(B2,B3,B4)*

**Spor C — token-gate & config**
- C1 `reelhome_avatar_config` UI (grensene + kostnadstak + early-bird). *(T0.3)*
- C2 Påmeldingsskjema + `POST /api/avatar/signup` (token, samtykke, ev. magic-link). *(T0.3)*
- C3 Grense-validering i `session/init` + parallellitet/utløp. *(C1,C2,B4)*
- C4 `cron/avatar-expire`. *(C2)*

**Spor D — personlig avatar (valgfritt MVP)**
- D1 Onboarding: Photo/Video Avatar-oppretting → `heygen_avatar_id`. *(T0.1)* — **kuttkandidat** (fallback = template).

### Fase 2 — Sammendrag (2 uker)
- E1 `POST /api/avatar/summarize` (Claude → strukturert JSON → `reelhome_buyer_summaries`). *(B2-logg)*
- E2 Interesse-score + kategorisering i prompten. *(E1)*
- E3 Resend-e-post (`lib/avatar/summary-email.ts`) + trigger fra `session/end`. *(E1)*
- E4 Dashboard sammendragsliste per eiendom. *(E1)*

### Fase 3 — Optimalisering (løpende)
- F1 Multi-språk (Whisper auto-språk + Claude svar-språk + HeyGen-stemme).
- F2 Avatar-valg (megler velger persona).
- F3 Kalenderintegrasjon for påmelding (Finn.no — åpent spørsmål 2).
- F4 Latency-tuning: setningsstreaming Claude→HeyGen, caching av embeddings.

---

## 9. Risiko & åpne spørsmål

**Fra konseptdokumentet:**
1. **HeyGen latency** → PoC T0.1 før alt annet. Mitigering: setningsstreaming, Sonnet ikke Opus.
2. **Finn.no-integrasjon for påmelding** → MVP bruker separat ReelHome-lenke (`/pamelding/[token]`); Finn-integrasjon utsettes til fase 3.
3. **GDPR** → §6: samtykke påkrevd, sletterutine via cron + cascade, DPA-oversikt.
4. **Avatar-identitet** → MVP: generisk «ReelHome-assistent» (template). Personlig avatar = valgfri D1/fase 3.
5. **TG2/TG3 juridisk sensitivt** → system-guardrail: beskriv funn ordrett, gi aldri råd, henvis til fagperson. Logg `chunk_refs` for sporbarhet.

**Egne tekniske:**
- **Delt Supabase med ContentForge:** `vector`-extension er prosjektnivå — bekreft at den ikke kolliderer med ContentForge-bruk. Alle tabeller `reelhome_`-prefikset.
- **Netlify-funksjonstid:** RAG+Claude-streaming må holde seg innen funksjons-timeout; derfor Sonnet + streaming, og tung PDF-jobb på droplet.
- **Droplet single point of failure:** :3004 deler maskin med scraper/trading/A-Pop. Dokument-prosessering er asynkron/idempotent (`status`-felt) → retry-bar, ikke kritisk sti.
- **Kostnadskontroll:** uten harde grenser kan en eiendom løpe løpsk. Grensene i `reelhome_avatar_config` MÅ håndheves i `session/init` (server-side), ikke bare vises.
- **HeyGen-nøkkel som «secret» i Netlify** → bruk `--force` ved env-set ellers kan du ikke teste lokalt; verifiser i prod.
- **Magic-link vs. ren token:** ren token er enklere (MVP); magic-link gir verifisert e-post men friksjon. Start med token + samtykke, legg magic-link på som opsjon.

---

## 10. Anbefalt MVP-kuttlinje

Lever **fungerende kjøperdialog gated på påmelding** så tidlig som mulig:

**Inkludert i MVP:**
- PDF-opplasting + droplet-pipeline + pgvector-RAG (A1–A3, B1–B2)
- Whisper + HeyGen template-avatar dialog (B3–B5)
- Token-påmelding + grense-håndheving + samtykke (C1–C4)
- Stripe per-eiendom-abonnement (kr 399) via eksisterende oppsett

**Kuttet fra MVP (fase 2/3):**
- Personlig HeyGen-avatar (D1) → bruk template, fallback finnes allerede
- Auto-sammendrag/interesse-score (E1–E4) → fase 2
- Magic-link → start med ren token + samtykke
- Finn.no-integrasjon, multi-språk, kalender → fase 3
- Bundle/per-samtale-prising → start med kun per-eiendom kr 399

**Hardt krav selv i kuttet MVP:** server-side grense-håndheving (kostnadskontroll), GDPR-samtykke ved påmelding, og anti-hallusinering/TG-guardrail i Claude-prompten.

---

### Kritiske filer for implementering
- `~/boligforge/supabase/migrations/001_initial_schema.sql` (RLS/tabell-mønster å speile i ny `20260610_avatar.sql`)
- `~/boligforge/lib/supabase/server.ts` (`getUser()` + service-role-mønster for megler- vs. kjøper-ruter)
- `~/boligforge/app/api/properties/generate-script/route.ts` (lazy Anthropic-klient + norsk Claude-prompt-mønster å gjenbruke i `ask`/`summarize`)
- `~/boligforge/app/api/properties/scrape/route.ts` (droplet `139.59.212.218`-integrasjonsmønster for PDF-pipeline på :3004)
- `~/boligforge/app/api/stripe/checkout/route.ts` + `app/api/stripe/webhook/route.ts` (per-eiendom abonnement + aktivering av `reelhome_avatar_config.enabled`)
