import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'

// PoC-only token-rute for LiveAvatar (fase 0 latency-test).
// Server-side: holder LIVEAVATAR_API_KEY hemmelig, returnerer kun en kortlivet session_token.
const LA_BASE = 'https://api.liveavatar.com'

export async function POST() {
  // Gated: oppretter LiveAvatar-sesjoner (koster kreditter) — kun innloggede brukere
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.LIVEAVATAR_API_KEY
  if (!key) return NextResponse.json({ error: 'LIVEAVATAR_API_KEY mangler' }, { status: 500 })

  // Pinnet avatar (env) hopper over liste-kallet — raskere oppkobling.
  const PREFERRED_AVATAR = process.env.AVATAR_LIVEAVATAR_ID
  let avatar: { id: string; name: string } | undefined
  if (PREFERRED_AVATAR) {
    avatar = { id: PREFERRED_AVATAR, name: 'pinned' }
  } else {
    const avatarsRes = await fetch(`${LA_BASE}/v1/avatars/public?page_size=20`, {
      headers: { 'X-API-KEY': key },
    })
    const avatarsJson = await avatarsRes.json()
    const results: Array<{ id: string; type: string; status: string; name: string }> =
      avatarsJson?.data?.results ?? []
    const active = results.filter(a => a.type === 'VIDEO' && a.status === 'ACTIVE')
    avatar =
      active.find(a => /ann/i.test(a.name)) ||
      [...active].sort((a, b) => a.id.localeCompare(b.id))[0] ||
      results[0]
  }
  if (!avatar) return NextResponse.json({ error: 'Ingen offentlig avatar tilgjengelig' }, { status: 502 })

  // 2. Opprett sesjons-token i FULL-modus — vi styrer teksten avataren sier (repeat()).
  //    LITE tillater ikke repeat() (innebygd samtale-agent). FULL krever avatar_persona m/ voice.
  // Norsk stemme: AVATAR_VOICE_ID er en LiveAvatar-bundet ElevenLabs-stemme
  // (Mia — norsk kvinne). Uten den: avatarens engelske default (rar dialekt).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const voiceId = process.env.AVATAR_VOICE_ID || (avatar as any).default_voice?.id || undefined
  const tokenRes = await fetch(`${LA_BASE}/v1/sessions/token`, {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'FULL',
      avatar_id: avatar.id,
      avatar_persona: {
        voice_id: voiceId,
        language: 'no',
        ...(process.env.AVATAR_VOICE_ID && {
          voice_settings: { model: 'eleven_flash_v2_5', stability: 0.75, similarity_boost: 0.75, speed: 1.0 },
        }),
      },
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
