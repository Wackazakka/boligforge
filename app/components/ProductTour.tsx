'use client'

import { useEffect } from 'react'
import { driver, type DriveStep, type Driver } from 'driver.js'
import { createBrowserClient } from '@supabase/ssr'
import 'driver.js/dist/driver.css'

// «Sett»-flagget maa hoere til BRUKEREN, ikke til nettleseren. Uten dette
// arvet en ny konto den forrige brukerens gjennomganger i samme nettleser:
// en tester slettet kontoen sin, registrerte seg paa nytt og fikk INGEN hjelp
// (maalt i prod 8/8). Samme problem paa et delt kontor-PC-er.
//
// getSession() leser fra cookie/lagring uten nettverkskall, saa dette koster
// ikke den forsinkelsen vi allerede har jaget bort en gang.
let cachedUid: string | null | undefined
async function currentUserId(): Promise<string | null> {
  if (cachedUid !== undefined) return cachedUid
  try {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await sb.auth.getSession()
    cachedUid = data.session?.user?.id ?? null
  } catch { cachedUid = null }
  return cachedUid
}

/** Alle tour-noekler starter med dette — hjelpesiden nullstiller paa prefikset. */
export const TOUR_KEY_PREFIX = 'rh_tour_'

/** Skrudd helt av: gjennomgangene starter ikke av seg selv i det hele tatt.
 *  Brukerbundet, som «sett»-flagget - en delt kontor-PC skal ikke arve valget. */
const AV_KEY = 'rh_tours_av'

/** Av for ALLE kontoer i denne nettleseren - bevisst IKKE brukerbundet. For den
 *  som logger inn paa mange kontoer i samme nettleser (Lars paa testkontoer,
 *  8/10): hver konto starter ellers fra null. Nye meglere paa egne maskiner
 *  roeres ikke. Noekkelen starter med «rh_tours», ikke «rh_tour_», saa
 *  nullstillingen paa Hjelp-siden (prefiks) tar den ikke med ved et uhell. */
const NETTLESER_AV_KEY = 'rh_tours_av_nettleser'

// --- Tilstand lagret PAA KONTOEN (profiles.tour_state via /api/profile/tour-state)
//
// localStorage alene ga gjennomgangene tilbake paa hver ny maskin og nettleser
// (Nina mellom PC og telefon, 8/10). Kontoen er sannheten; localStorage er
// den raske reserven som svarer foer nettet. Hentes EN gang per sidelast, og
// hentingen starter idet ProductTour monteres - saa svaret som regel er der
// foer ankeret finnes i DOM-en. Vi venter maks 2 s paa det: aa gate touren paa
// et kaldt API-svar ga 3-4 s forsinkelse sist (maalt 8/8).
type TourState = { av?: boolean; sett?: string[] }
let statePromise: Promise<TourState> | null = null

export function hentTourState(): Promise<TourState> {
  if (!statePromise) {
    statePromise = fetch('/api/profile/tour-state', { cache: 'no-store' })
      .then(r => (r.ok ? (r.json() as Promise<TourState>) : {}))
      .catch(() => ({}))
  }
  return statePromise
}

function lagreTourState(patch: { av?: boolean; sett?: string; nullstill?: boolean }) {
  // Oppdater den lokale kopien foerst, saa samme sidelast ikke viser den igjen
  statePromise = hentTourState().then(s => {
    const neste: TourState = { ...s }
    if (patch.av !== undefined) neste.av = patch.av
    if (patch.nullstill) neste.sett = []
    if (patch.sett) neste.sett = Array.from(new Set([...(neste.sett ?? []), patch.sett]))
    return neste
  })
  // keepalive: «sett» skrives idet brukeren lukker boblen og ofte navigerer
  // videre i samme sekund - kallet skal overleve sidebyttet.
  fetch('/api/profile/tour-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
    keepalive: true,
  }).catch(() => { /* reserve = localStorage */ })
}

function medFrist<T>(p: Promise<T>, ms: number, reserve: T): Promise<T> {
  return Promise.race([p, new Promise<T>(res => setTimeout(() => res(reserve), ms))])
}

export function nettleserTurerErAv(): boolean {
  try { return window.localStorage.getItem(NETTLESER_AV_KEY) === '1' } catch { return false }
}

export function settNettleserTurerAv(av: boolean) {
  try { av ? window.localStorage.setItem(NETTLESER_AV_KEY, '1') : window.localStorage.removeItem(NETTLESER_AV_KEY) } catch { /* ignore */ }
}

export async function turerErAv(): Promise<boolean> {
  if (nettleserTurerErAv()) return true
  try { if (window.localStorage.getItem(await scopedKey(AV_KEY)) === '1') return true } catch { /* ignore */ }
  const s = await medFrist(hentTourState(), 2000, {})
  return s.av === true
}

export async function settTurerAv(av: boolean) {
  const k = await scopedKey(AV_KEY)
  try { av ? window.localStorage.setItem(k, '1') : window.localStorage.removeItem(k) } catch { /* ignore */ }
  lagreTourState({ av })
}

/** «Vis paa nytt»: glem alle «sett»-flagg paa kontoen (localStorage ryddes av Hjelp-siden). */
export function nullstillSetteTurer() {
  lagreTourState({ nullstill: true })
}

async function scopedKey(base: string): Promise<string> {
  const uid = await currentUserId()
  return uid ? `${base}:${uid}` : base
}

export type TourStep = {
  selector: string
  title: string
  description: string
}

// Kun én driver.js-instans om gangen — uten dette kan et automatisk
// engangs-tour og et manuelt "?"-trigget tour kollidere i samme overlay.
let activeTour: Driver | null = null
let activeKey: string | null = null        // uid-bundet localStorage-noekkel
let activeBaseKey: string | null = null    // noekkelen uten uid - slik kontoen lagrer den

function merkSett() {
  try { if (activeKey) window.localStorage.setItem(activeKey, '1') } catch { /* ignore */ }
  if (activeBaseKey) lagreTourState({ sett: activeBaseKey })
}

function startTour(storageKey: string, baseKey: string, steps: TourStep[]) {
  activeTour?.destroy()
  activeKey = storageKey
  activeBaseKey = baseKey


  const driveSteps: DriveStep[] = steps.map(s => ({
    element: s.selector,
    // Ingen fast side/align: driver.js sin auto-plassering unngår at popoveren
    // havner utenfor skjermen (skjedde med 'align: start' på knapper langt til høyre).
    popover: { title: s.title, description: s.description },
  }))

  activeTour = driver({
    showProgress: steps.length > 1,
    // Kun × og «Skjønner!» avslutter. Standard er at et klikk hvor som helst
    // på det dimmede overlayet lukker touren — og da forsvant den når man
    // byttet til et annet program og klikket tilbake i vinduet (målt 8/8):
    // fokus-klikket traff overlayet. Ekstra viktig nå som lukking lagres
    // permanent — et vådeklikk ville drept gjennomgangen for godt.
    allowClose: false,
    // Litt større avstand til det markerte elementet: standard 10 px lot
    // popoveren klistre seg til kortet, som forsterket inntrykket av at den
    // var en del av samme skjema.
    popoverOffset: 16,
    nextBtnText: 'Neste →',
    prevBtnText: '← Tilbake',
    // «Lukk», ikke «Ferdig». Siste steg er ofte selve handlingen («Trykk
    // Generer manus»), og da stod «Ferdig» som et konkurrerende alternativ til
    // knappen ved siden av - som om man kunne bli ferdig uten aa gjoere noe.
    doneBtnText: 'Lukk',
    progressText: '{{current}} av {{total}}',
    steps: driveSteps,
    // driver.js 1.8 fjerner ikke .driver-active-element fra forrige steg —
    // målt i prod 8/8: etter fire steg hadde ALLE fire elementene klassen.
    // Klassen styrer pointer-events under touren, så da forblir seksjoner man
    // har forlatt klikkbare. Rydd selv ved hvert bytte.
    // Av-bryteren hoerer hjemme DER irritasjonen er - men som TEKST i bunnen
    // gled den inn i resten av avsnittet og kunne legge seg over knappene.
    // Et kryss oeverst til hoeyre er den vante plasseringen for «bort med
    // dette», og ligger absolutt posisjonert utenfor tekstflyten.
    //
    // Krysset LUKKER denne gjennomgangen - det er hva et kryss betyr overalt
    // ellers. Det er nok: turene vises bare én gang per bruker, saa lukking
    // betyr i praksis at den ikke kommer tilbake. Aa la krysset skru av ALT
    // ville vaert en felle - den som bommer merker det foerst naar hjelpen
    // mangler et sted han trengte den, og skjoenner ikke hvorfor. Den globale
    // av-bryteren ligger paa Hjelp-siden, der den er et bevisst valg.
    onPopoverRender: (popover: { wrapper: HTMLElement }) => {
      const k = document.createElement('button')
      k.type = 'button'
      k.textContent = '×'
      k.title = 'Lukk gjennomgangen'
      k.setAttribute('aria-label', 'Lukk gjennomgangen')
      k.style.cssText = [
        'position:absolute', 'top:6px', 'right:8px',
        'background:none', 'border:none', 'padding:2px 6px',
        'color:rgba(255,255,255,0.45)', 'font-size:18px', 'line-height:1',
        'cursor:pointer',
      ].join(';')
      k.onmouseenter = () => { k.style.color = 'rgba(255,255,255,0.9)' }
      k.onmouseleave = () => { k.style.color = 'rgba(255,255,255,0.45)' }
      k.onclick = () => closeTour()   // markerer som sett, som «Lukk»-knappen
      // IKKE sett position her. driver.js posisjonerer boblen med fixed, og en
      // inline 'relative' slaar ut hele plasseringen - boblen faller tilbake til
      // aa flyte i dokumentet og havner oeverst paa siden, langt fra elementet
      // den peker paa. Maalt 11/8: elementet laa 1737 px over synsfeltet mens
      // boblen sto paa top 9,9. En fixed boks er allerede posisjoneringskontekst
      // for absolutte barn, saa krysset trenger ingenting.
      popover.wrapper.appendChild(k)
    },
    onHighlightStarted: (el?: Element) => {
      document.querySelectorAll('.driver-active-element').forEach(e => {
        if (e !== el) e.classList.remove('driver-active-element')
      })
    },
    // «Sett» = brukeren avsluttet selv (× eller «Skjønner!»). onDestroyStarted
    // fyrer KUN på brukerinitiert lukking — driver.js' egen destroy() kaller
    // h(false) og hopper over hooken, så ingen rekursjon her.
    //
    // Hvorfor ikke merke ved start: da mistet man gjennomgangen for godt hvis
    // siden lastet på nytt før man rakk å lese (profilsiden har opplastinger
    // og lagring). Og hvorfor ikke onDestroyed: den fyrer aldri når man
    // avslutter fra siste steg — se måling i prod 8/8.
    onDestroyStarted: () => {
      merkSett()
      activeTour?.destroy()
    },
    onDestroyed: () => {
      activeTour = null
      activeKey = null
      activeBaseKey = null
      document.querySelectorAll('.driver-active-element').forEach(e => e.classList.remove('driver-active-element'))
    },
  })

  activeTour.drive()
}

/** Viser touren kun første gang — `storageKey` styrer om den alt er sett. */
export async function runTourOnce(storageKey: string, steps: TourStep[]) {
  if (await turerErAv()) return
  const key = await scopedKey(storageKey)
  try {
    // Rydd bort den gamle, ikke-brukerbundne noekkelen. Den skal IKKE arves som
    // «sett» — det var nettopp den som gjorde nye kontoer hjelpeloese.
    if (key !== storageKey) window.localStorage.removeItem(storageKey)
    if (window.localStorage.getItem(key) === '1') return
  } catch { /* ignore */ }
  // Sett paa en annen maskin/nettleser? Kontoen vet. Speil svaret lokalt saa
  // neste sidelast slipper aa vente paa nettet.
  const s = await medFrist(hentTourState(), 2000, {})
  if (s.sett?.includes(storageKey)) {
    try { window.localStorage.setItem(key, '1') } catch { /* ignore */ }
    return
  }
  startTour(key, storageKey, steps)
}

/** Lukker en aktiv tur — brukes naar brukeren utfoerer handlingen turen peker paa.
 *  Maa skrive «sett»-flagget selv: driver.js' destroy() kaller h(false) og hopper
 *  over onDestroyStarted, saa turen ville ellers dukket opp igjen neste gang. */
export function closeTour() {
  if (!activeTour) return
  merkSett()
  activeTour.destroy()
}

/**
 * Brukeren utfoerte handlingen steget peker paa: gaa VIDERE, ikke lukk.
 * Aa lukke hele turen her tok fra folk de gjenstaaende stegene - men aa bli
 * staaende er heller ikke greit, siden boblen legger seg oppaa resultatet
 * (avatar-videoen dukker opp rett under knappen som ble trykket).
 */
export function advanceTour() {
  if (!activeTour) return
  if (activeTour.hasNextStep?.()) activeTour.moveNext()
  else closeTour()
}

/** Maaler markeringen paa nytt — kall den naar det markerte elementet endrer
 *  stoerrelse (f.eks. naar avatar-videoen dukker opp inne i blokka). */
/** Maaler markeringen paa nytt naar SAMME element endrer stoerrelse - f.eks.
 *  naar en video faar kjent hoeyde etter at metadataene er lastet. Lettere enn
 *  refreshTour(), som loeser opp elementet paa nytt. */
export function remeasureTour() {
  activeTour?.refresh?.()
}

export function refreshTour() {
  if (!activeTour) return
  // refresh() maaler elementet driver.js alt har lagret - den slaar IKKE opp
  // selectoren paa nytt. Naar markeringen skal flytte seg fordi DOM-en er
  // byttet ut (knappen erstattes av videoen), maa steget kjoeres om.
  const idx = activeTour.getActiveIndex?.()
  if (typeof idx === 'number') activeTour.drive(idx)
  else activeTour.refresh?.()
}

/** Kjører touren uansett — for manuell gjenåpning (f.eks. en "?"-knapp). */
export async function runTour(storageKey: string, steps: TourStep[]) {
  startTour(await scopedKey(storageKey), storageKey, steps)
}

export default function ProductTour({
  storageKey,
  steps,
  when = true,
}: {
  storageKey: string
  steps: TourStep[]
  /** Kjør først når betingelsen er sann (f.eks. når elementene faktisk finnes i DOM-en) */
  when?: boolean
}) {
  useEffect(() => {
    if (!when) return
    // Start så snart FØRSTE anker finnes i DOM-en — ikke etter en fast pause
    // og ikke etter at data er lastet. Å gate på et API-svar ga 3–4 sekunders
    // forsinkelse ved kald Netlify-funksjon (målt 8/8): brukeren hadde
    // allerede begynt å lese skjemaet da boksen plutselig dukket opp.
    let cancelled = false
    let tries = 0
    // Start hentingen av kontoens tilstand NAA, parallelt med ventingen paa
    // ankeret - saa er svaret som regel klart naar runTourOnce spoer.
    void hentTourState()
    const tick = () => {
      if (cancelled) return
      if (steps[0] && document.querySelector(steps[0].selector)) {
        runTourOnce(storageKey, steps)
        return
      }
      if (tries++ < 50) setTimeout(tick, 100)   // gir opp etter ~5 s
    }
    const t = setTimeout(tick, 50)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, storageKey])

  return null
}
