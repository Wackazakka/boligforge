import { NextResponse } from 'next/server'
import { resolveAvatarAccess } from '../../../../lib/avatar/access'
import { serviceClient } from '../../../../lib/avatar/rag'

// D-ID Agents Streams — server-side proxy (Avatar Nivå 2 eval).
// Vi bruker den NAKNE client-keyen (Client-Key <key>, uten SDK-ens external-user-suffiks
// som denne nøkkeltypen avviste). Rå WebRTC i nettleseren snakker med disse proxy-actionene.
// Holder nøkkelen server-side + unngår CORS/domene-lås. Tekst drives av Claude (/api/avatar/ask).
const DID_BASE = 'https://api.d-id.com'

// Hvilke stemme-IDer som faktisk er klonet INN i D-ID-kontoen (via POST /tts/voices).
// Brukes for å avgjøre om en per-megler cloned_voice_id er D-ID-egen (ingen ekstern nøkkel)
// eller en gammel ekstern EL-klone som IKKE finnes hos D-ID (→ fall tilbake til Mia, ikke frys).
// Caches 10 min så vi ikke henter den store lista per speak.
let didVoiceCache: { ids: Set<string>; at: number } | null = null
async function didNativeVoiceIds(apiKey: string): Promise<Set<string>> {
  if (didVoiceCache && Date.now() - didVoiceCache.at < 600_000) return didVoiceCache.ids
  try {
    const r = await fetch(`${DID_BASE}/tts/voices`, { headers: { Authorization: `Basic ${apiKey}` } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any = await r.json()
    const ids = new Set<string>(Array.isArray(list) ? list.map((v: { id?: string }) => v.id).filter(Boolean) as string[] : [])
    didVoiceCache = { ids, at: Date.now() }
    return ids
  } catch { return didVoiceCache?.ids ?? new Set() }
}

export async function POST(request: Request) {
  // Varig konto-API-nøkkel (Basic). Erstattet den flyktige share-client-keyen som utløp.
  const apiKey = process.env.DID_API_KEY
  const agentId = process.env.DID_AGENT_ID
  if (!apiKey || !agentId) return NextResponse.json({ error: 'DID_API_KEY / DID_AGENT_ID mangler' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const access = await resolveAvatarAccess(body.propertyId, body.viewingToken)
  if (!access.ok) return NextResponse.json({ error: 'Ingen gyldig tilgang' }, { status: 401 })

  const action = body.action as string
  const base = `${DID_BASE}/agents/${agentId}/streams`
  const headers: Record<string, string> = { Authorization: `Basic ${apiKey}`, 'Content-Type': 'application/json' }

  try {
    if (action === 'create') {
      const r = await fetch(base, { method: 'POST', headers, body: JSON.stringify({}) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return NextResponse.json({ error: 'create feilet', detail: d }, { status: 502 })
      return NextResponse.json(d) // { id, offer, ice_servers, session_id }
    }

    const streamId = body.streamId as string
    const session_id = body.session_id as string
    if (!streamId || !session_id) return NextResponse.json({ error: 'streamId/session_id mangler' }, { status: 400 })

    if (action === 'sdp') {
      const r = await fetch(`${base}/${streamId}/sdp`, {
        method: 'POST', headers, body: JSON.stringify({ session_id, answer: body.answer }),
      })
      const d = await r.json().catch(() => ({}))
      return NextResponse.json(d, { status: r.ok ? 200 : 502 })
    }

    if (action === 'ice') {
      const r = await fetch(`${base}/${streamId}/ice`, {
        method: 'POST', headers,
        body: JSON.stringify({ session_id, candidate: body.candidate, sdpMid: body.sdpMid, sdpMLineIndex: body.sdpMLineIndex }),
      })
      const d = await r.json().catch(() => ({}))
      return NextResponse.json(d, { status: r.ok ? 200 : 502 })
    }

    if (action === 'speak') {
      // Egen ElevenLabs-stemme (Mia / per-megler) hvis DID_VOICE_ID satt + Pro-plan + EL-nøkkel
      // koblet i D-ID. Hvis det feiler (ikke låst opp ennå), fall tilbake til agentens egen
      // norske stemme (Azure nb-NO) så avataren ALLTID svarer.
      // Per-megler stemme (eiendommens meglers ElevenLabs-klone). KREVER at klonene er
      // importert/koblet på konto-nivå hos D-ID — private kloner uten den koblingen gir
      // «speak 200 OK» men INGEN media (frossen avatar). Skrus på med DID_PER_MEGLER_VOICE=1
      // når importen er bekreftet. Av = Mia (DID_VOICE_ID) for alle, som virker.
      // To slags stemmer med ULIK auth:
      //  • Global Mia (DID_VOICE_ID) = EKSTERN EL-stemme → KREVER x-api-key-external.
      //  • Per-megler cloned_voice_id = klonet INN i D-ID-kontoen via POST /tts/voices →
      //    D-ID eier den, INGEN ekstern nøkkel (sender vi den, leter D-ID i feil konto → frossen).
      // Vi sporer derfor per stemme om den er D-ID-egen, ikke ut fra flagget.
      // Per-megler-stemme er PÅ by default; native-sjekken under gjør det trygt (ukvalifiserte
      // stemmer faller til Mia). Kill-switch: sett DID_PER_MEGLER_VOICE=0 for å tvinge Mia for alle.
      let voiceId = process.env.DID_VOICE_ID
      let isDidNativeVoice = false
      if (process.env.DID_PER_MEGLER_VOICE !== '0') {
        try {
          const svc = serviceClient()
          const { data: prop } = await svc.from('properties').select('user_id').eq('id', body.propertyId).maybeSingle()
          if (prop?.user_id) {
            const { data: profile } = await svc.from('agent_profiles').select('cloned_voice_id').eq('user_id', prop.user_id).maybeSingle()
            // Bruk per-megler-stemmen KUN hvis den faktisk er klonet inn i D-ID-kontoen.
            // Ellers (gammel ekstern EL-klone) → behold Mia, så vi ikke fryser avataren.
            if (profile?.cloned_voice_id) {
              const native = await didNativeVoiceIds(apiKey!)
              if (native.has(profile.cloned_voice_id)) { voiceId = profile.cloned_voice_id; isDidNativeVoice = true }
            }
          }
        } catch { /* faller tilbake til DID_VOICE_ID (Mia) */ }
      }

      async function doSpeak(useVoice: boolean) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const script: any = { type: 'text', input: body.input }
        const reqHeaders: Record<string, string> = { ...headers }
        if (useVoice && voiceId) {
          script.provider = { type: 'elevenlabs', voice_id: voiceId }
          // Ekstern nøkkel KUN for eksterne EL-stemmer (Mia). D-ID-egne kloner skal IKKE ha den.
          if (!isDidNativeVoice) {
            const elKey = process.env.ELEVENLABS_API_KEY
            if (elKey) reqHeaders['x-api-key-external'] = JSON.stringify({ elevenlabs: elKey })
          }
        }
        const r = await fetch(`${base}/${streamId}`, {
          method: 'POST', headers: reqHeaders, body: JSON.stringify({ session_id, script }),
        })
        return { ok: r.ok, data: await r.json().catch(() => ({})) }
      }
      let res = await doSpeak(true)
      if (!res.ok && voiceId) res = await doSpeak(false) // fallback til Azure-stemmen
      if (!res.ok) return NextResponse.json({ error: 'speak feilet', detail: res.data }, { status: 502 })
      return NextResponse.json(res.data)
    }

    if (action === 'delete') {
      await fetch(`${base}/${streamId}`, { method: 'DELETE', headers, body: JSON.stringify({ session_id }) })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'ukjent action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
