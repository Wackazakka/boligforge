'use client'

import { useEffect } from 'react'

// Captures a seller ref (?ref=) and optional discount flag (?rabatt=1) into localStorage,
// first-touch (never overwritten). Applied to the org during onboarding.
export default function RefCapture() {
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const ref = p.get('ref')
      if (ref && !localStorage.getItem('reelhome_ref')) {
        localStorage.setItem('reelhome_ref', ref)
        if (p.get('rabatt') === '1') localStorage.setItem('reelhome_discount', '1')
      }
    } catch {
      // ignore (SSR / no storage)
    }
  }, [])
  return null
}
