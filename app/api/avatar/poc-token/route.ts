import { NextResponse } from 'next/server'

// PoC-only token-rute for LiveAvatar (fase 0 latency-test).
// Server-side: holder LIVEAVATAR_API_KEY hemmelig, returnerer kun en kortlivet session_token.
const LA_BASE = 'https://api.liveavatar.com'

export async function POST() {
  const key = process.env.LIVEAVATAR_API_KEY
  if (!key) return NextResponse.json({ error: 'LIVEAVATAR_API_KEY mangler' }, { status: 500 })

  // 1. Hent en offentlig, aktiv VIDEO-avatar (PoC bruker en ferdig avatar).
  const avatarsRes = await fetch(`${LA_BASE}/v1/avatars/public?page_size=20`, {
    headers: { 'X-API-KEY': key },
  })
  const avatarsJson = await avatarsRes.json()
  const results: Array<{ id: string; type: string; status: string; name: string }> =
    avatarsJson?.data?.results ?? []
  const avatar =
    results.find(a => a.type === 'VIDEO' && a.status === 'ACTIVE') ?? results[0]
  if (!avatar) return NextResponse.json({ error: 'Ingen offentlig avatar tilgjengelig' }, { status: 502 })

  // 2. Opprett sesjons-token i FULL-modus — vi styrer teksten avataren sier (repeat()).
  //    LITE tillater ikke repeat() (innebygd samtale-agent). FULL krever avatar_persona m/ voice.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const voiceId = (avatar as any).default_voice?.id
  const tokenRes = await fetch(`${LA_BASE}/v1/sessions/token`, {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'FULL',
      avatar_id: avatar.id,
      avatar_persona: { voice_id: voiceId, language: 'no' },
    }),
  })
  const tokenJson = await tokenRes.json()
  const sessionToken = tokenJson?.data?.session_token
  if (!sessionToken) {
    return NextResponse.json({ error: 'Token-oppretting feilet', detail: tokenJson }, { status: 502 })
  }

  return NextResponse.json({
    session_token: sessionToken,
    session_id: tokenJson.data.session_id,
    avatar: { id: avatar.id, name: avatar.name },
  })
}
