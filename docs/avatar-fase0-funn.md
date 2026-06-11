# Avatar Fase 0 — funn (2026-06-09)

PoC-de-risking av HeyGen/LiveAvatar-integrasjonen. Branch: `feat/avatar-fase0`.

## Viktigste oppdagelse: HeyGen Streaming → LiveAvatar
Det gamle HeyGen Streaming Avatar-API-et (`/v1/streaming.*`) er **sanset (mars 2026) og dødt**. Produktet er flyttet til **LiveAvatar** (liveavatar.com), eget API + ny SDK. Planen (avatar-implementeringsplan.md) må oppdateres tilsvarende.

| Gammelt (dødt) | Nytt (gjeldende) |
|---|---|
| `api.heygen.com/v1/streaming.*` | `api.liveavatar.com/v1/*` |
| `@heygen/streaming-avatar` | `@heygen/liveavatar-web-sdk` |
| `x-api-key` på `/v1/streaming.create_token` | `X-API-KEY` på `/v1/sessions/token` |

## Verifisert mot live API (med Lars' nøkkel)
- **Nøkkel gyldig** ✅ (lagret i `~/boligforge/.env.local` som `LIVEAVATAR_API_KEY`, gitignored — aldri committet).
- **Token-oppretting fungerer ende-til-ende:** `POST /v1/sessions/token` med `{"mode":"LITE","avatar_id":"<uuid>"}` → `session_id` + `session_token` (JWT). HTTP 200, **~0,65 s**.
- **Modus:** `mode` = `FULL` (avatar + avatar_persona/voice/context/språk) eller `LITE` (kun avatar_id).
- **Avatarer:** kontoen har **0 egne** avatarer ennå. `GET /v1/avatars/public` gir **83 offentlige** (f.eks. "Ann Therapist", `513fd1b7-7ef9-466d-9af2-344e51eeb833`, type VIDEO, m/ default_voice). For PoC brukes en offentlig; for produkt lages meglerens egen avatar i LiveAvatar (Alt B video).

## SDK-API (fra offisiell demo `heygen-com/liveavatar-web-sdk`)
```ts
import { LiveAvatarSession, SessionEvent, VoiceChatEvent, AgentEventsEnum } from "@heygen/liveavatar-web-sdk";
const session = new LiveAvatarSession(sessionToken, { voiceChat: true });
session.on(SessionEvent.SESSION_STREAM_READY, () => { /* video klar */ });
session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => { /* mål latency her */ });
session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {});
await session.start();
// ... voiceChat + transkripsjon innebygd ...
await session.stop();
```

## Konsekvenser for implementeringsplanen
1. **Whisper kan utgå/forenkles:** LiveAvatar har **innebygd voice chat + transkripsjon** (`USER_TRANSCRIPTION`, `AVATAR_TRANSCRIPTION`, `USER_SPEAK_STARTED/ENDED`). Eget Whisper-steg i dataflyten er trolig unødvendig for tale-inn.
2. **Env-var:** `LIVEAVATAR_API_KEY` (ikke `HEYGEN_API_KEY`). Settes i Netlify via `netlify env:set --force` ved deploy.
3. **DB-navngiving:** `agent_profiles.liveavatar_avatar_id/_voice_id`, `reelhome_avatar_sessions.liveavatar_session_id` (oppdatert i migrasjonen).
4. **Token-ruten** (`/api/avatar/session/init`) kaller `POST https://api.liveavatar.com/v1/sessions/token` server-side med `LIVEAVATAR_API_KEY`, returnerer kun `session_token` til klienten.

## Resultater fra browser-PoC (oppdatert 2026-06-10)
Alle Fase 0-spørsmålene er nå besvart med målinger i ekte browser:

- **Talelatency: 0,6–1,1 s konsistent** (633/816/960/998/1031/1099 ms over flere sesjoner/dager) — godt innenfor målet. **Grønt lys.**
- **STREAM_READY:** 2,3–7,6 s (varierer med last) — akseptabelt med en «kobler til megler…»-spinner.
- **Innebygd STT VIRKER — Whisper strykes fra arkitekturen:** `voiceChat.start()` (publiserer mikrofonsporet, MÅ kalles — `startListening()` alene er kun server-signal) + `startListening()` → `USER_TRANSCRIPTION` leverer tekst. Med `language: 'no'` i avatar_persona kom norsk tale ut som **korrekt norsk** («Kommer du fra Lofoten?»). Med 'en' ble norsk feiltolket (italiensk!) — språkkonfig er kritisk.
- **Avataren snakker norsk** uten problemer (repeat med norsk tekst + norsk persona).
- **Svart video løst:** eksplisitt `videoEl.play()` etter `session.attach()` (autoplay-policy).
- **Viktige driftsfunn:** (1) Claude-appens innebygde preview kan IKKE gi mikrofontilgang — test i ekte browser. (2) Kontoen går tom for kreditter ved mye testing — «Insufficient credits for session» ved session.start(). (3) repeat() før session.start() er ferdig gir «Session needs to be connected».

## Gjenstår (overført til Fase 1)
- Storage-bucket `avatar-docs` (T0.4) — opprettes sammen med migrasjonen.
- Migrasjonen (`supabase/migrations/20260609_avatar.sql`) er **ikke kjørt** ennå. Blokkeringen (delt DB med ContentForge) forsvant 2026-06-10 da CF fikk eget prosjekt — kan nå kjøres trygt mot ReelHome-prosjektet.
- Flette disse funnene inn i hovedplanen (`docs/avatar-implementeringsplan.md`) — bl.a. stryke Whisper-steget og oppdatere HeyGen→LiveAvatar.

## Gjenbrukskart fra søsterprodukter (utforsket 2026-06-10)

**Dr. Hanni (Wackazakka/dr-hanni) — RAG-skjelettet finnes allerede:**
- `netlify/functions/import-knowledge.js`: PDF/tekst → chunking (400 ord) → batch-embedding (OpenAI `text-embedding-3-small`, 1536 dim — samme som vår migrasjon) → pgvector. **Portes nesten 1:1** til vår `reelhome_avatar_chunks`.
- `netlify/functions/search-knowledge.js`: embed spørsmål → RPC-søk → top-k. Matcher vår `match_avatar_chunks`.
- `netlify/functions/session-1-chat.js`: Claude-dialogloop (Sonnet) med kontekst-injeksjon og **[REPLY]/[KNOWLEDGE]-dobbeltsvar** (svar + strukturert ekstraksjon i samme kall) — nøyaktig mønsteret avatar-svaret + visning-lead-fangst trenger. Gotcha derfra: sanitiser alternerende user/assistant-turer.
- ElevenLabs-TTS m/ norsk stemme + privat audio-bucket-mønster (vår `avatar-docs` følger samme RLS-oppsett).

**SummonIt (Wackazakka/software-factory) — validerings-/ekstraksjonsmønstre:**
- `netlify/functions/_outcomes.js`: generate→grade(haiku)→retry-loop. Adopteres for å validere ekstraherte visning-påmeldinger (navn/telefon/e-post) før insert.
- Advarsel derfra: marker-/regex-parsing (`---SPEC---`) er skjørt — vi bruker heller **Claude tool use** for lead-ekstraksjon (strukturert og validert ved generering).
- Ingen RAG i SummonIt (bekreftet) — Dr. Hanni er kilden for det.

**Konsekvens for Fase 1-estimatet:** ingestion-pipeline, retrieval og dialogloop er i stor grad porteringsarbeid, ikke nybygg — estimatet på 4–6 uker kan trolig kuttes betydelig.
