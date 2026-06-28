# ReelHome — Interaktiv AI-megler (digital visning)

*Hvordan den interaktive avataren fungerer — for utviklere og investorer.*

---

## Hva vi har laget

En **interaktiv AI-megler for digital visning**: en naturtro videoavatar som snakker med
boligkjøpere i sanntid, på norsk, og svarer på spørsmål om akkurat *den* boligen — basert
på de faktiske salgsdokumentene (salgsoppgave + tilstandsrapport). Avataren har meglerens
eget ansikt og stemme, er tilgjengelig døgnet rundt, og fanger interesserte kjøpere som leads.

## Arkitektur

```
   Kjøper  ⇄  LiveAvatar (HeyGen)  ⇄  Vår hjerne (egen LLM-adapter)
            video · tale · sanntid          │
                                ┌───────────┴────────────┐
                         Kunnskapsbase             Claude (haiku)
                          (Supabase pgvector)
                                ▲
              Salgsoppgave + tilstandsrapport (PDF) → biter → embeddings
```

- **Lilla = HeyGen-plattform** · **Grønt = vårt (RAG + Claude)** · **Grått = data/bruker**
- Visuelt diagram: `docs/liveavatar-arkitektur.svg`

## Slik foregår én samtale

1. Kjøper åpner en lenke til visningen og **snakker**.
2. **LiveAvatar (HeyGen)** håndterer det sanntidskrevende: videostrøm, tale-til-tekst, turtaking.
3. Spørsmålet sendes som tekst til **vår egen «hjerne»**.
4. Hjernen finner riktig bolig, henter de mest relevante utdragene fra **kunnskapsbasen**, og
   lar **Claude** skrive et kort, presist norsk svar — kun fra dokumentene.
5. Svaret går tilbake til LiveAvatar, som **leser det opp med meglerens klonede stemme** og
   animerer avataren.
6. Kjøper hører svaret på et par sekunder. Vil de avbryte, trykker de bare mikrofonen igjen.

## Kunnskapsbasen — hvorfor svarene er til å stole på

- Megler laster opp **salgsoppgave + tilstandsrapport (PDF)**.
- Teksten trekkes ut, deles i biter, gjøres om til **embeddings** og lagres i en
  **vektordatabase (Supabase pgvector)** knyttet til boligen.
- Ved hvert spørsmål: **hybrid-søk** (semantisk + nøkkelord + nabobiter) finner de riktige
  avsnittene — også avvik som ligger spredt i rapporten.
- **Guardrails:** svarer kun fra dokumentene, gjetter aldri på pris/mål/tilstand, korte
  muntlige svar — men fullstendige lister ved avvik (TG2/TG3).

## Den tekniske kjernen (for utviklere)

Det avgjørende grepet er **FULL-modus med egen LLM**:

- HeyGen/LiveAvatar gjør det som er vanskelig i sanntid (STT, TTS, ~100 FPS video-render, barge-in).
- **Vi eier hjernen:** et OpenAI-kompatibelt `/chat/completions`-endepunkt som LiveAvatar
  kaller som sin LLM. Der ligger hele RAG-stacken + Claude + norsk tall/uttale-prosessering
  + lead-verktøyet (`registrer_interessent`).
- Resultat: **best-i-klassen video/stemme fra HeyGen + vår domenespesifikke norske
  intelligens**, med full kontroll på data, logikk og kostnad.

**Stack:** Next.js · Supabase (PostgreSQL + pgvector) · Claude (haiku) · ElevenLabs (stemme)
· HeyGen/LiveAvatar (video) · D-ID (foto-avatar).

## Hvorfor dette er en forsvarsverdi (for investorer)

- **Eierskap til hjernen** — kvaliteten ligger i RAG + prompt + norsk-tilpasning. Det er
  vårt, ikke en commodity.
- **Leverandør-uavhengig** — samme hjerne driver *både* LiveAvatar (premium video) og D-ID
  (foto-avatar). Vi kan bytte/forhandle leverandør uten å bygge om kjernen.
- **Data + leads** — hver samtale er strukturert lead-fangst, det egentlige verdipoenget
  for megleren.
- **Målbart og styrbart** — per-minutt-måling (faktureringsgrunnlag) og byrå-styrte
  av/på-brytere er bygget inn.

## Det rundt

- **Stemme:** meglerens egen stemme klonet via ElevenLabs (enkel IVC eller proff PVC), bundet
  til avataren.
- **To nivåer:** foto-avatar (klar fra bildet, ingen opptak) og video-avatar (naturtro,
  krever ~2 min opptak).
- **Distribusjon:** personlig, tidsbegrenset lenke til påmeldte kjøpere — kostnadskontroll
  + lead-fangst.
