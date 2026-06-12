import { NextResponse } from 'next/server'
import { resolveAvatarAccess } from '../../../../lib/avatar/access'

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
  const headers = { Authorization: `Basic ${apiKey}`, 'Content-Type': 'application/json' }

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
      // Egen ElevenLabs-stemme (Mia / per-megler) hvis DID_VOICE_ID satt + premium D-ID;
      // ellers agentens egen norske stemme (Azure nb-NO).
      const voiceId = process.env.DID_VOICE_ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const script: any = { type: 'text', input: body.input }
      if (voiceId) script.provider = { type: 'elevenlabs', voice_id: voiceId }
      const r = await fetch(`${base}/${streamId}`, {
        method: 'POST', headers, body: JSON.stringify({ session_id, script }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return NextResponse.json({ error: 'speak feilet', detail: d }, { status: 502 })
      return NextResponse.json(d)
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
