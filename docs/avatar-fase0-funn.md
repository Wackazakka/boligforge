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

## Gjenstår i Fase 0
- **Ekte avatar-talelatency** (tid speak → `AVATAR_SPEAK_STARTED`) må måles i browser med SDK-en — token-latency (~0,65 s) er kun halve bildet. Krever en liten PoC-side kjørt mot en isolert dev.
- Storage-bucket `avatar-docs` (T0.4) — opprettes når migrasjonen kjøres mot isolert dev-DB.
- Migrasjonen er skrevet (`supabase/migrations/20260609_avatar.sql`) men **ikke kjørt** mot noen DB ennå (isolasjon — venter på Supabase preview-branch eller lokal).
