import { NextResponse } from 'next/server'
import { resolveAvatarAccess } from '../../../../lib/avatar/access'
import { serviceClient } from '../../../../lib/avatar/rag'

// D-ID Agents Streams — server-side proxy (Avatar Nivå 2 eval).
// Vi bruker den NAKNE client-keyen (Client-Key <key>, uten SDK-ens external-user-suffiks
// som denne nøkkeltypen avviste). Rå WebRTC i nettleseren snakker med disse proxy-actionene.
// Holder nøkkelen server-side + unngår CORS/domene-lås. Tekst drives av Claude (/api/avatar/ask).
const DID_BASE = 'https://api.d-id.com'

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
  // Bruk ReelHomes EGEN ElevenLabs-konto for ElevenLabs-stemmer (Mia / per-megler) — sendes
  // per kall via x-api-key-external, så ingen oppkobling i D-ID Studio trengs. Krever Pro-plan.
  const elKey = process.env.ELEVENLABS_API_KEY
  if (process.env.DID_VOICE_ID && elKey) {
    headers['x-api-key-external'] = JSON.stringify({ elevenlabs: elKey })
  }

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
      // Per-megler stemme: bruk eiendommens meglers egen ElevenLabs-klone (samme stemme som
      // i videoene deres). Faller tilbake til DID_VOICE_ID (felles Mia), så Azure ved feil.
      let voiceId = process.env.DID_VOICE_ID
      try {
        const svc = serviceClient()
        const { data: prop } = await svc.from('properties').select('user_id').eq('id', body.propertyId).maybeSingle()
        if (prop?.user_id) {
          const { data: profile } = await svc.from('agent_profiles').select('cloned_voice_id').eq('user_id', prop.user_id).maybeSingle()
          if (profile?.cloned_voice_id) voiceId = profile.cloned_voice_id
        }
      } catch { /* faller tilbake til DID_VOICE_ID */ }

      async function doSpeak(useVoice: boolean) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const script: any = { type: 'text', input: body.input }
        if (useVoice && voiceId) script.provider = { type: 'elevenlabs', voice_id: voiceId }
        const r = await fetch(`${base}/${streamId}`, {
          method: 'POST', headers, body: JSON.stringify({ session_id, script }),
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
