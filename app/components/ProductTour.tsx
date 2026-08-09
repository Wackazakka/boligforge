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
let activeKey: string | null = null

function startTour(storageKey: string, steps: TourStep[]) {
  activeTour?.destroy()
  activeKey = storageKey


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
      try { window.localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
      activeTour?.destroy()
    },
    onDestroyed: () => {
      activeTour = null
      activeKey = null
      document.querySelectorAll('.driver-active-element').forEach(e => e.classList.remove('driver-active-element'))
    },
  })

  activeTour.drive()
}

/** Viser touren kun første gang — `storageKey` styrer om den alt er sett. */
export async function runTourOnce(storageKey: string, steps: TourStep[]) {
  const key = await scopedKey(storageKey)
  try {
    // Rydd bort den gamle, ikke-brukerbundne noekkelen. Den skal IKKE arves som
    // «sett» — det var nettopp den som gjorde nye kontoer hjelpeloese.
    if (key !== storageKey) window.localStorage.removeItem(storageKey)
    if (window.localStorage.getItem(key) === '1') return
  } catch { /* ignore */ }
  startTour(key, steps)
}

/** Lukker en aktiv tur — brukes naar brukeren utfoerer handlingen turen peker paa.
 *  Maa skrive «sett»-flagget selv: driver.js' destroy() kaller h(false) og hopper
 *  over onDestroyStarted, saa turen ville ellers dukket opp igjen neste gang. */
export function closeTour() {
  if (!activeTour) return
  try { if (activeKey) window.localStorage.setItem(activeKey, '1') } catch { /* ignore */ }
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
  startTour(await scopedKey(storageKey), steps)
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
