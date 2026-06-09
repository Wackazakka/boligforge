# Plan: «Behold flere stemmekloner» i ReelHome

*Utarbeidet: 2026-06-09 · Opus plan-agent (read-only, verifisert mot kode + ElevenLabs)*

## Sammendrag

Megleren skal kunne klone stemmen sin flere ganger uten å miste de gamle, høre en prøve av hver, sammenligne to mot hverandre, gi dem navn, slette dem, og velge hvilken som er **aktiv**. I dag overskriver `clone-voice`-ruten både `default_voice_id` og `cloned_voice_id` på `agent_profiles` — kun én klone overlever.

Kjernegrep: en ny tabell `reelhome_voice_clones` (én rad per klone per megler) blir kilden til sannhet for klonede stemmer. `agent_profiles.default_voice_id` beholdes som «aktiv stemme»-pekeren — **uendret semantikk** mot videogenerering — og synkroniseres til den klonen som er markert aktiv. `cloned_voice_id` blir legacy/redundant og fases ut, men beholdes utfylt for bakoverkompatibilitet.

Viktig realitet (verifisert mot ElevenLabs): **alle meglere deler samme `ELEVENLABS_API_KEY` og dermed samme voice-pool**, med et hardt tak på antall custom voices for hele kontoen (Free 3, Starter 10, Creator 30, Pro 160, Scale/Business 660). «Behold flere kloner» multiplisert med antall meglere kan sprenge taket. Planen håndterer dette med per-megler-cap + entydig navngiving + opprydding.

## Nåværende flyt (verifisert)

**Datamodell i dag** — `agent_profiles` (delt Supabase-prosjekt `jvnavubholyvihvytqkn`) har `default_voice_id` og `cloned_voice_id`. API-laget aliaser: `app/api/profile/get/route.ts` mapper `default_voice_id → voice_id` ut til klienten og sender `cloned_voice_id` rått. `app/api/profile/save/route.ts` skriver `voice_id → default_voice_id` og **ekskluderer bevisst `cloned_voice_id`** (skal kun settes av clone-ruten).

**Kloning** — `app/api/profile/clone-voice/route.ts`: POSTer lyd til `https://api.elevenlabs.io/v1/voices/add` med navn = `profile.name || 'Meglers stemme'`, får `voice_id`, og gjør `upsert` på `agent_profiles` som setter **både** `default_voice_id` og `cloned_voice_id` = ny `voice_id` (onConflict: `user_id`). Dette er overskrivingen.

**Hvordan stemmen BRUKES i generering** (kritisk):
- `app/dashboard/properties/[id]/page.tsx:362`: `effectiveVoiceId = activeAvatar?.voiceId ?? profile.voice_id ?? ''`. En valgt template-avatar har sin egen `voiceId` som vinner; ellers brukes meglerens `profile.voice_id` (= `default_voice_id`).
- Denne `effectiveVoiceId` brukes til (a) TTS-preview per segment (`/api/profile/tts-preview`), og (b) sendes som `voiceId` i body til `POST /api/video/generate`.
- `app/api/video/generate/route.ts` tar imot `voiceId` fra requesten og dispatcher den videre til droplet-worker (`http://139.59.212.218:3003/jobs/video`). Worker leser ikke `default_voice_id` selv; den får `voiceId` servert.

**Konklusjon for integrasjon:** «aktiv stemme» = `agent_profiles.default_voice_id`. Sørger vi for at den aktive klonen alltid speiles dit, fungerer videogenerering helt uendret. **Ingen** endring i `video/generate`, droplet-worker, eller property-siden.

**Prøveavspilling** finnes allerede: `app/api/profile/tts-preview/route.ts` genererer kort TTS (`eleven_turbo_v2_5`, `language_code: 'no'`) for en gitt `voiceId`, laster opp til R2 og returnerer `audioUrl`. `playVoiceSample(voiceId, previewUrl?)` i profil-siden gjenbrukes direkte for prøve + sammenligning.

## Datamodell

Ny migrasjon `supabase/migrations/20260609_voice_clones.sql` (følger `reelhome_`-prefiks + RLS-stil fra `20260608_affiliate.sql`):

```sql
-- ReelHome: behold flere stemmekloner per megler.
-- reelhome_*-prefiks fordi Supabase-prosjektet er DELT med ContentForge.
create table if not exists reelhome_voice_clones (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  elevenlabs_voice_id text not null,            -- voice_id fra ElevenLabs (delt pool!)
  name                text not null,            -- meglerens visningsnavn ("Min stemme jan-26")
  sample_url          text,                     -- valgfri R2-URL til generert prøve (cache)
  is_active           boolean not null default false,
  created_at          timestamptz default now()
);

create unique index if not exists reelhome_voice_clones_one_active
  on reelhome_voice_clones (user_id) where (is_active);
create index if not exists reelhome_voice_clones_user_idx
  on reelhome_voice_clones (user_id);
create unique index if not exists reelhome_voice_clones_user_voice
  on reelhome_voice_clones (user_id, elevenlabs_voice_id);

alter table reelhome_voice_clones enable row level security;
drop policy if exists "Users manage own voice clones" on reelhome_voice_clones;
create policy "Users manage own voice clones" on reelhome_voice_clones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "service role all" on reelhome_voice_clones;
create policy "service role all" on reelhome_voice_clones
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
```

**Forhold til `agent_profiles`:**
- `default_voice_id` = **aktiv stemme** (uendret rolle mot generering). Settes til `elevenlabs_voice_id` for klonen med `is_active = true`. Velger megleren i stedet en *template*-stemme, settes `default_voice_id` til template-IDen og ingen klone er aktiv.
- `cloned_voice_id` = legacy. Holdes synkronisert til aktiv klone for bakoverkompatibilitet; fases ut senere (out of scope).

## Klone-rute

Endre `app/api/profile/clone-voice/route.ts`:
1. Etter vellykket `voices/add` og mottatt `voiceId`:
2. **Cap-sjekk per megler:** tell `reelhome_voice_clones` for `user.id`. Hvis ≥ `MAX_CLONES_PER_AGENT` (foreslått **3**), returner `409 { code: 'CLONE_LIMIT' }` + eksisterende kloner, så UI kan be megleren slette en.
3. **Sett alle eksisterende kloner `is_active = false`**, `insert` ny rad med `is_active = true`, `name`, `elevenlabs_voice_id = voiceId`.
4. **Speil til `agent_profiles`:** `upsert` `default_voice_id = voiceId` og `cloned_voice_id = voiceId` (onConflict `user_id`) — ny klone umiddelbart aktiv.
5. Returner `{ voice_id, clones: [...] }`.

**Entydig navngiving i ElevenLabs (delt pool):** send `name` til `voices/add` som `ReelHome:<user_id-kort>:<meglernavn>` for sporbart eierskap. Meglerens visningsnavn lagres separat i `reelhome_voice_clones.name`.

Ny rute `app/api/profile/voice-clones/route.ts`:
- `GET` — liste kloner for innlogget megler (RLS isolerer).
- `PATCH` `{ id, name?, makeActive? }` — rename og/eller sett aktiv. Ved `makeActive`: sett alle `is_active=false`, valgt `is_active=true`, `upsert agent_profiles.default_voice_id = klonens voice_id`.
- `DELETE` `{ id }` — slett rad **og** `DELETE https://api.elevenlabs.io/v1/voices/{voice_id}` (frigjør slott). Var den aktiv: velg ny aktiv (nyeste gjenværende, ellers default template) og oppdater `default_voice_id`. Tål 404.

**ElevenLabs-endepunkter:** `POST /v1/voices/add`, `GET /v1/voices`, `GET /v1/voices/{id}`, `DELETE /v1/voices/{id}`, `POST /v1/text-to-speech/{id}`. Merk: produkt-nøkkel mangler ofte `user_read` → `GET /v1/user/subscription` (kvote) kan feile; ikke avhengiggjør flyten av det.

## Profil-UI

Endre `app/dashboard/profile/page.tsx`, «Stemme og tone» (~linje 415–480). Erstatt enkelt-`cloned_voice_id`-knappen med en **klone-liste** fra `GET /api/profile/voice-clones`:
- Per rad: navn, «Aktiv»-badge hvis `default_voice_id === elevenlabs_voice_id`, + handlinger:
  - **▶ Hør** — gjenbruk `playVoiceSample(elevenlabs_voice_id)` (faller til `tts-preview`). Cache i `sample_url`.
  - **Velg aktiv** — `PATCH {id, makeActive:true}` + lokal `set('voice_id', voiceId)`.
  - **Gi nytt navn** — inline → `PATCH {id, name}`.
  - **Slett** — bekreftelse (advarsel: frigjør stemme i delt konto) → `DELETE {id}`.
- **Sammenlign to stemmer:** velg to → «Spill begge» (samme korte setning via `tts-preview`, sekvensiell avspilling). Ingen ny backend.
- **Klone på nytt:** eksisterende opptaks-UI beholdes; `submitClone` leser `data.clones`. Håndter `409 CLONE_LIMIT`: «Du har nådd maks antall stemmer (3). Slett en for å klone på nytt.»
- **Template-stemmene** (`VOICES`) uendret.

## Integrasjon med videogenerering

**Ingen endring kreves i genererings-stacken.** `agent_profiles.default_voice_id` (= `profile.voice_id`) peker alltid på aktiv stemme:
- `effectiveVoiceId = activeAvatar?.voiceId ?? profile.voice_id` — template-avatar overstyrer fortsatt (bevisst).
- Når aktiv klone velges, skriver `PATCH .../voice-clones` til `default_voice_id`. Neste profil-henting gir riktig `voice_id` til både segment-preview og `video/generate`. Droplet-worker uberørt.

Regresjonssjekk: `clone-voice` og `PATCH makeActive` skal **alltid** skrive `default_voice_id`, ellers kan megler ende med tom aktiv stemme.

## Delt ElevenLabs-konto & grenser

- **Én konto, én pool, ett tak** (Pro 160, Scale/Business 660). 100 meglere × cap 3 = 300 → sprenger Pro. Derfor per-megler-cap (3) **og** global vurdering mot kontotak før bred utrulling. Overvåk `GET /v1/voices`-antall.
- **Entydig navngiving:** prefiks `ReelHome:<user_id-kort>:`.
- **Eierskap & sletting:** RLS isolerer *rader*, men `DELETE /v1/voices/{id}` er konto-globalt. Mitigering: slett kun voice-IDer som finnes i innlogget meglers egne rader (verifiser i DB før ElevenLabs-kall). Aldri ta voice-ID fra klient uten å sjekke mot egen rad.
- **ContentForge** deler Supabase-prosjektet (isolert via `reelhome_`-prefiks + RLS). Deler den også ElevenLabs-nøkkel, må global cap ta høyde for begge — flagg for produkteier.

## Datamigrasjon

I samme migrasjonsfil — flytt eksisterende `cloned_voice_id` inn som aktiv klone:
```sql
insert into reelhome_voice_clones (user_id, elevenlabs_voice_id, name, is_active)
select ap.user_id, ap.cloned_voice_id,
       coalesce(nullif(ap.name,''), 'Min stemme'), true
from agent_profiles ap
where ap.cloned_voice_id is not null and ap.cloned_voice_id <> ''
on conflict (user_id, elevenlabs_voice_id) do nothing;
```
Idempotent. `default_voice_id` røres ikke.

## Edge-cases & risiko

- **ElevenLabs-tak nådd ved `voices/add`** → fang feil, returner `CLONE_LIMIT`, ikke skriv rad.
- **Sletting av aktiv stemme** → backend velger ny aktiv (nyeste gjenværende, ellers default template) + oppdaterer `default_voice_id`.
- **Megler sletter stemme en annen «eier»** → forhindret: verifiser at voice-ID tilhører innlogget meglers egne rader før ElevenLabs-`DELETE`.
- **Stemme slettet i ElevenLabs, finnes i DB** → ved preview/generering-404: vis «finnes ikke lenger hos leverandøren», tilby sletting av rad. Ved `DELETE`: tål 404.
- **Kvote-/scope-lesing mangler** → ikke avhengiggjør flyten av `GET /v1/user/subscription`.
- **Race på `is_active`** → unik partial-index `(user_id) where is_active` garanterer maks én aktiv.

## Faseplan

1. **Datamodell & migrasjon** — `20260609_voice_clones.sql` (tabell + indekser + RLS + dataflytting). Kjør + verifiser.
2. **Backend** — `clone-voice` (legg til + cap + aktiver + speil); ny `voice-clones` (`GET`/`PATCH`/`DELETE`).
3. **Profil-UI** — klone-liste (hør/velg/rename/slett); `submitClone` håndterer `409`.
4. **Sammenlign + polering** — sammenlign-to-stemmer, cache `sample_url`, bekreftelser.
5. **Drift** — overvåk global voice-antall mot kontotak.

## Anbefalt MVP

1. **Migrasjon** — tabell + RLS + flytt eksisterende `cloned_voice_id` inn.
2. **`clone-voice`** — insert ny rad (ikke overskriv) + sett aktiv + speil til `default_voice_id`; cap 3 med `409`.
3. **`voice-clones`-rute** — `GET` + `PATCH makeActive` (rename/delete kan vente).
4. **Profil-UI** — vis liste, «▶ Hør», «Velg aktiv», enkel «Spill begge»-sammenligning.

Kuttet fra MVP: sletting i ElevenLabs, rename, sample-caching, global cap-overvåking. **Integrasjon mot videogenerering krever ingen kode** — `default_voice_id` er allerede koblingspunktet.

---

### Kritiske filer
- `app/api/profile/clone-voice/route.ts`
- `app/dashboard/profile/page.tsx`
- `app/api/profile/get/route.ts` (alias `default_voice_id ↔ voice_id`)
- `supabase/migrations/20260608_affiliate.sql` (mal for ny migrasjon m/ RLS)
- `app/api/profile/tts-preview/route.ts` (gjenbrukes for prøve + sammenligning)
