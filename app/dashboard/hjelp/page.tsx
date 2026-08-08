'use client'

import { useMemo, useState } from 'react'

/**
 * Hjelpesenteret. Produktturene er rene handlingslister («gjør dette nå») —
 * kunnskapen som før lå i turboblene bor her, der den kan slås opp når
 * spørsmålet faktisk dukker opp.
 *
 * Innholdet er kundevendt. Interne forbehold fra docs/kunnskapsbase.md
 * (Meta-godkjenning for eksterne, nynorsk) er bevisst holdt utenfor eller
 * formulert som «under utrulling» — vi lover ikke noe som ikke er verifisert.
 */

type Topic = { q: string; a: string; list?: string[] }
type Section = { id: string; title: string; topics: Topic[] }

const SECTIONS: Section[] = [
  {
    id: 'kom-i-gang',
    title: 'Komme i gang',
    topics: [
      {
        q: 'Hva gjør ReelHome?',
        a: 'Du limer inn lenken til boligannonsen på Finn eller Hjem. ReelHome henter bilder, pris, adresse og nøkkeldata, skriver et manus, leser det inn med en AI-stemme eller din egen klonede stemme, lar en avatar presentere boligen og setter alt sammen til en ferdig film med musikk og logoen din. En video tar rundt fem minutter å generere.',
      },
      {
        q: 'Hva bør jeg gjøre først?',
        a: 'Fire ting, i denne rekkefølgen:',
        list: [
          'Velg avatar — en av seks ferdige AI-meglere, eller last opp ditt eget portrett',
          'Legg til stemme — standardstemme, eller klon din egen',
          'Last opp logo (valgfritt) — den vises til slutt i videoene',
          'Lag din første video — lim inn en Finn- eller Hjem-lenke',
        ],
      },
      {
        q: 'Kontoret mitt bruker allerede ReelHome — skal jeg registrere meg selv?',
        a: 'Nei, be dem invitere deg fra Team-siden. Da havner du i riktig organisasjon med riktig rolle. Registrerer du deg på egen hånd, blir du stående utenfor kontoret.',
      },
      {
        q: 'Invitasjonslenken min virker ikke',
        a: 'Lenken i invitasjons-e-posten er en engangslenke — den logger deg inn og kobler deg til organisasjonen første gang du klikker. Er den brukt eller utløpt, be om en ny invitasjon.',
      },
    ],
  },
  {
    id: 'profil',
    title: 'Profil, stemme og avatar',
    topics: [
      {
        q: 'Kan jeg bruke mitt eget ansikt?',
        a: 'Ja. Last opp et portrettbilde under Profil, så presenterer du boligene selv. Du kan når som helst bytte mellom eget portrett og de seks malene (Sofia, Marius, Ingrid, Even, Hanna, Erik).',
      },
      {
        q: 'Hva er «settings»?',
        a: 'Med eget portrett kan du generere profesjonelle miljøbilder av deg selv — kontor, stue og lignende. Det tar ett til to minutter per bilde. Du kan redigere prompten per setting og styre detaljer selv, for eksempel klesstil.',
      },
      {
        q: 'Hvordan kloner jeg stemmen min?',
        a: 'Under Profil leser du inn en tekst. Ta gjerne hele — rundt to minutters lesing gir best resultat. Sett deg i et stille rom først: bakgrunnsstøy blir en del av klonen og følger da alle videoene dine. Klonen brukes også av AI-megleren for kjøpere.',
      },
      {
        q: 'Hva er forskjellen på «tone» og «stil»?',
        a: 'Tonen på profilen beskriver hvem du er som megler og preger manuset — ikke selve stemmen. Stilvalget per video er målgruppetilpasning og legges oppå tonen din. De to kombineres; stilen overstyrer ikke tonen.',
      },
      {
        q: 'Jeg byttet logo, men ser ingen endring',
        a: 'Logoen gjelder videoer som genereres etterpå. Generer videoen på nytt, så kommer den nye logoen med. Bakgrunnen på avslutningsplakaten velges automatisk i hvitt eller svart etter logoens farger, så en mørk logo aldri forsvinner i mørk bakgrunn.',
      },
      {
        q: 'Logoen min er låst — hvorfor kan jeg ikke bytte den?',
        a: 'Kontoret eller kjeden din har satt en offisiell logo, og da gjelder den for alle medlemmene. Det sikrer et likt uttrykk utad. Skal den endres, må en administrator i organisasjonen gjøre det.',
      },
    ],
  },
  {
    id: 'video',
    title: 'Lage video',
    topics: [
      {
        q: 'Bør jeg dele manuset opp i segmenter?',
        a: 'Ja, det er det anbefalte veivalget. Da kobles riktig boligbilde til hver del av manuset, og du får sjekke hver bit for seg før videoen lages. Hopper du over, leses hele manuset i ett strekk over bare de åtte første bildene i listen — resten blir ikke med.',
      },
      {
        q: 'Stemmen uttaler et navn feil',
        a: 'Stav ordet i manuset slik det skal HØRES ut. «Kilevold» skrives «Kjilevold», «Skjeberg» skrives «Sjeberg». Da blir det riktig hver gang.',
      },
      {
        q: 'Hva er forskjellen på «Hør innlesing» og «Ny innlesing»?',
        a: '«Hør innlesing» spiller alltid av den innlesingen som allerede finnes. «Ny innlesing» lager en ny versjon — og nullstiller samtidig et godkjent avatar-klipp for det segmentet, siden klippet er bakt sammen med den gamle lyden.',
      },
      {
        q: 'Kan jeg se avataren før videoen lages?',
        a: 'Ja. På avatar-segmenter trykker du «Forhåndsvis animasjonen» (tar ett til tre minutter) og lager nye takes til du er fornøyd. De siste fem takene ligger under «Tidligere takes» — trykk «Bruk denne» for å bytte. Klippet du godkjenner brukes nøyaktig som det er i den ferdige videoen. Forhåndsvisninger koster ikke videokreditt.',
      },
      {
        q: 'Hva gjør merket nede til venstre på et bilde?',
        a: 'Det veksler mellom «Bevegelse» og «Stillbilde» for akkurat det bildet. Nyttig på plantegninger og prospektsider, der langsom zoom ofte ser rart ut.',
      },
      {
        q: 'Hvilke formater får jeg?',
        a: 'Videoen produseres i 1080p 16:9 (bredformat). Fra den ferdige videoen lager du med ett klikk 9:16 (stående, for Reels, TikTok og Snapchat) og 1:1 (kvadratisk) — samme innhold, tilpasset formatet.',
      },
      {
        q: 'Kan jeg endre en ferdig video?',
        a: 'Ja. Trykk «Rediger» på videoen, så kommer du tilbake med manus, segmenter og godkjente avatar-klipp intakt. Endre det du vil og generer på nytt — det koster en ny videokreditt. Gjelder videoer laget fra 5. august 2026; eldre videoer har ikke lagret redigeringstilstand.',
      },
      {
        q: 'Selger satte ned prisen — hva gjør jeg?',
        a: 'Lim inn annonse-lenken på nytt, så oppdateres boligen (det lages ikke duplikat). Åpne «Rediger» på videoen, oppdater prisen i manus-segmentene der den nevnes, og generer på nytt. Tittelkort og faktatekst bygges alltid ferskt fra boligdataene.',
      },
      {
        q: 'Hvilket språk lages videoene på?',
        a: 'Norsk. Flere språk står på veikartet.',
      },
    ],
  },
  {
    id: 'priser',
    title: 'Videoer, priser og fakturering',
    topics: [
      {
        q: 'Hva koster en video?',
        a: 'Én videokreditt per generering — også når du genererer på nytt etter en redigering. Kredittene er personlige: hver megler har sin egen månedskvote fra planen, pluss eventuelle ekstra kjøpte videoer. Dashbordet viser hva du har igjen.',
      },
      {
        q: 'Hva koster planene?',
        a: 'Priser per august 2026, eks. mva., fakturert månedlig i NOK:',
        list: [
          'Starter — 2 090 kr/mnd for 3 videoer i måneden',
          'Pro — 3 990 kr/mnd for 10 videoer i måneden',
          'Kontor — 1 990 kr/megler/mnd for 7 videoer per megler (avtale via hei@reelhome.ai)',
          'Ekstra videoer — 989 kr per stykk, kjøpes på toppen av abonnementet uten å bytte plan',
        ],
      },
      {
        q: 'Forsvinner ubrukte videoer ved månedsskiftet?',
        a: 'Nei, ubrukte videoer blir med videre.',
      },
      {
        q: 'Er det bindingstid?',
        a: 'Nei. Alle abonnement starter med 14 dagers gratis prøveperiode uten kortinfo, og du beholder tilgangen ut betalt periode. Alle filmer du har produsert kan lastes ned. Tidlige brukere låser dagens pris i to år.',
      },
    ],
  },
  {
    id: 'deling',
    title: 'Publisering og deling',
    topics: [
      {
        q: 'Hvordan får jeg videoen ut?',
        a: 'Last den ned i 16:9, 9:16 eller 1:1 og publiser hvor du vil — Finn-annonsen, Facebook, Instagram, LinkedIn, TikTok. Nedlasting fungerer for alle kontoer.',
      },
      {
        q: 'Kan ReelHome publisere rett til Facebook og Instagram?',
        a: 'Direkte publisering finnes under Publisering, der du kobler kontoene dine og planlegger innlegg, og Kalender-siden viser oversikten. Funksjonen er under utrulling — er den ikke tilgjengelig for kontoen din ennå, last ned videoen og publiser manuelt i mellomtiden.',
      },
    ],
  },
  {
    id: 'team',
    title: 'Team, meglerhus og kjede',
    topics: [
      {
        q: 'Hvilke roller finnes?',
        a: 'Tre nivåer:',
        list: [
          'Megler — lager videoer og har egen profil, avatar, stemme og kreditter',
          'Admin (kontorsjef) — alt en megler kan, pluss Team-siden for å invitere og administrere meglere på kontoret',
          'Kjedeadmin — i tillegg Kjede-siden: opprett kontorer, inviter kontorsjefer, og se forbruket per kontor',
        ],
      },
      {
        q: 'Hvordan setter en kjede opp kontorene sine?',
        a: 'Fra Kjede-siden oppgir du kontornavn og kontorsjefens e-post. Kontorsjefen får en invitasjon, blir admin for sitt kontor og inviterer sine egne meglere fra Team-siden.',
      },
      {
        q: 'Hvem betaler — hovedkontoret eller kontorene?',
        a: 'I dag betaler hvert kontor for seg selv, med egen prøveperiode og eget abonnement. Kjedeledelsen ser samlet forbruk på Kjede-siden. Sentral fakturering med kredittfordeling står på veikartet.',
      },
      {
        q: 'Jeg finner ikke Team- eller Kjede-menyen',
        a: 'De menyene vises kun for administratorer. Er du admin og de likevel mangler, logg ut og inn igjen. Vedvarer det, kontakt hei@reelhome.ai.',
      },
      {
        q: 'Kontoret mitt er i en kjede som ikke bruker ReelHome ennå',
        a: 'Start på egen hånd. Kontoret kan kobles til kjeden i etterkant — ta kontakt på hei@reelhome.ai når det blir aktuelt.',
      },
    ],
  },
  {
    id: 'kjoper',
    title: 'AI-megler for kjøpere',
    topics: [
      {
        q: 'Hva er den digitale visningen?',
        a: 'Hver bolig får en unik kjøperlenke du kan dele i annonsen eller på visning. Kjøperen trenger verken konto eller innlogging, og møter en snakkende AI-utgave av deg som svarer på spørsmål muntlig eller skriftlig — døgnet rundt. Svarene hentes fra salgsoppgaven, tilstandsrapporten og boligdataene, og AI-en svarer kun på det som står der.',
      },
      {
        q: 'Får jeg vite hvem som har vært innom?',
        a: 'Sier kjøperen at de vil på visning eller bli kontaktet, registrerer AI-megleren navn og kontaktinfo, og du får beskjed.',
      },
      {
        q: 'Kan jeg få den?',
        a: 'AI-megleren er under utrulling og selges ikke som egen plan ennå. Ta kontakt på hei@reelhome.ai hvis du vil være med tidlig.',
      },
    ],
  },
  {
    id: 'personvern',
    title: 'Personvern og rettigheter',
    topics: [
      {
        q: 'Hvem kan bruke stemmeklonen min?',
        a: 'Bare du. Klonen brukes utelukkende i din egen konto og dine egne videoer.',
      },
      {
        q: 'Kan jeg bruke musikken kommersielt?',
        a: 'Ja. Musikkbiblioteket er royalty-fritt og lisensiert for kommersiell bruk.',
      },
      {
        q: 'Hvor lagres dataene?',
        a: 'Person- og boligdata lagres i EU (Frankfurt). Mediefiler som bilder og video ligger hos Cloudflare R2. Boligdata hentes fra offentlig tilgjengelige annonser på Finn eller Hjem, som megleren selv limer inn.',
      },
    ],
  },
]

const TOUR_KEYS = [
  'rh_tour_properties_empty',
  'rh_tour_properties_card',
  'rh_tour_profile',
  'rh_tour_property_setup',
  'rh_tour_property_split',
  'rh_tour_property_review',
]

export default function HelpPage() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [toursReset, setToursReset] = useState(false)

  const needle = q.trim().toLowerCase()
  const sections = useMemo(() => {
    if (!needle) return SECTIONS
    return SECTIONS
      .map(s => ({ ...s, topics: s.topics.filter(t =>
        (t.q + ' ' + t.a + ' ' + (t.list?.join(' ') ?? '')).toLowerCase().includes(needle)) }))
      .filter(s => s.topics.length > 0)
  }, [needle])

  const hits = sections.reduce((n, s) => n + s.topics.length, 0)

  const resetTours = () => {
    try { TOUR_KEYS.forEach(k => window.localStorage.removeItem(k)) } catch { /* ignore */ }
    setToursReset(true)
  }

  return (
    <div className="space-y-5" style={{ maxWidth: '760px' }}>
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--sans)' }}>Hjelp</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          Svar på det folk lurer på. Finner du ikke svaret, skriv til{' '}
          <a href="mailto:hei@reelhome.ai" style={{ color: 'var(--gold)' }}>hei@reelhome.ai</a> — vi svarer samme arbeidsdag.
        </p>
      </div>

      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(null) }}
        placeholder="Søk — for eksempel «uttale», «logo», «pris»"
        className="app-input w-full"
        style={{ padding: '11px 14px' }}
      />

      {needle && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {hits === 0 ? 'Ingen treff. Prøv et annet ord, eller skriv til hei@reelhome.ai.' : `${hits} treff`}
        </p>
      )}

      {sections.map(s => (
        <section key={s.id} className="app-card space-y-1" style={{ padding: '10px 14px' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--muted)', padding: '6px 0' }}>{s.title}</h2>
          {s.topics.map(t => {
            const id = s.id + t.q
            const isOpen = open === id || !!needle
            return (
              <div key={id} style={{ borderTop: '1px solid var(--line)' }}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen && !needle ? null : id)}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                           padding: '10px 0', color: 'var(--ink)', fontSize: '14px', fontWeight: 500,
                           display: 'flex', gap: '10px', alignItems: 'baseline' }}
                >
                  <span style={{ color: 'var(--gold)', fontSize: '11px', flexShrink: 0 }}>{isOpen ? '▾' : '▸'}</span>
                  {t.q}
                </button>
                {isOpen && (
                  <div style={{ padding: '0 0 12px 21px' }}>
                    <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{t.a}</p>
                    {t.list && (
                      <ul className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6, marginTop: '8px', paddingLeft: '18px', listStyle: 'disc' }}>
                        {t.list.map(li => <li key={li} style={{ marginTop: '3px' }}>{li}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}

      <section className="app-card space-y-2">
        <h2 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Gjennomgangene på sidene</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Første gang du er innom en side, viser ReelHome en kort gjennomgang som peker på hva du skal gjøre.
          Vil du se dem igjen, nullstiller du dem her — så dukker de opp neste gang du besøker hver side.
        </p>
        <button type="button" onClick={resetTours} className="app-btn-secondary text-xs" style={{ padding: '8px 14px' }}>
          {toursReset ? '✓ Nullstilt — gå til en side for å se den' : 'Vis gjennomgangene på nytt'}
        </button>
      </section>
    </div>
  )
}
