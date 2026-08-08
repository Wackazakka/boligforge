'use client'

import { useEffect } from 'react'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'

export type TourStep = {
  selector: string
  title: string
  description: string
}

// Kun én driver.js-instans om gangen — uten dette kan et automatisk
// engangs-tour og et manuelt "?"-trigget tour kollidere i samme overlay.
let activeTour: Driver | null = null

function startTour(storageKey: string, steps: TourStep[]) {
  activeTour?.destroy()


  const driveSteps: DriveStep[] = steps.map(s => ({
    element: s.selector,
    // Ingen fast side/align: driver.js sin auto-plassering unngår at popoveren
    // havner utenfor skjermen (skjedde med 'align: start' på knapper langt til høyre).
    popover: { title: s.title, description: s.description },
  }))

  activeTour = driver({
    showProgress: steps.length > 1,
    // Litt større avstand til det markerte elementet: standard 10 px lot
    // popoveren klistre seg til kortet, som forsterket inntrykket av at den
    // var en del av samme skjema.
    popoverOffset: 16,
    nextBtnText: 'Neste →',
    prevBtnText: '← Tilbake',
    doneBtnText: 'Skjønner!',
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
      document.querySelectorAll('.driver-active-element').forEach(e => e.classList.remove('driver-active-element'))
    },
  })

  activeTour.drive()
}

/** Viser touren kun første gang — `storageKey` styrer om den alt er sett. */
export function runTourOnce(storageKey: string, steps: TourStep[]) {
  try {
    if (window.localStorage.getItem(storageKey) === '1') return
  } catch { /* ignore */ }
  startTour(storageKey, steps)
}

/** Kjører touren uansett — for manuell gjenåpning (f.eks. en "?"-knapp). */
export function runTour(storageKey: string, steps: TourStep[]) {
  startTour(storageKey, steps)
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
    // Vent én tick så elementene med data-tour-attributter er rendret.
    const t = setTimeout(() => runTourOnce(storageKey, steps), 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, storageKey])

  return null
}
