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
    nextBtnText: 'Neste →',
    prevBtnText: '← Tilbake',
    doneBtnText: 'Skjønner!',
    progressText: '{{current}} av {{total}}',
    steps: driveSteps,
    onDestroyed: () => {
      activeTour = null
      try { window.localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
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
