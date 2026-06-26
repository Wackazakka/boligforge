// Klient-side minutt-måler for avatar-sesjoner. Starter en sesjon, sender heartbeat
// hvert 20. sek, og finaliserer ved stop/pagehide (keepalive så den fyrer ved
// fane-lukking). Server beregner varigheten autoritativt.

export interface UsageMeter { stop: () => void }

export function startUsageMeter(propertyId: string, provider: 'liveavatar' | 'did'): UsageMeter {
  let sessionId: string | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let stopped = false
  const visitorSession = Math.random().toString(36).slice(2)

  function track(id: string, ended: boolean) {
    fetch('/api/avatar/usage/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, ended }), keepalive: ended,
    }).catch(() => {})
  }
  function ping() { if (sessionId) track(sessionId, false) }
  const onHide = () => { if (sessionId) track(sessionId, true) }

  fetch('/api/avatar/usage/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, provider, visitorSession }),
  }).then(r => r.json()).then(d => {
    if (!d?.sessionId) return
    sessionId = d.sessionId
    if (stopped) { track(sessionId!, true); return }  // avsluttet før start rakk å svare
    timer = setInterval(ping, 20000)
  }).catch(() => {})

  if (typeof window !== 'undefined') window.addEventListener('pagehide', onHide)

  return {
    stop() {
      stopped = true
      if (timer) clearInterval(timer)
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', onHide)
      if (sessionId) track(sessionId, true)
    },
  }
}
