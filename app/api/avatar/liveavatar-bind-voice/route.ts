// Binder meglerens klonede ElevenLabs-stemme (cloned_voice_id) til LiveAvatar via
// third-party-import, og lagrer den returnerte liveavatar_voice_id på profilen.
// LiveAvatar bruker da meglerens egen stemme i stedet for fallback-stemmen.

import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'
import { serviceClient } from '../../../../lib/avatar/rag'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const secretId = process.env.LIVEAVATAR_ELEVEN_SECRET_ID
  const apiKey = process.env.LIVEAVATAR_API_KEY
  if (!secretId || !apiKey) return NextResponse.json({ error: 'LiveAvatar ikke konfigurert' }, { status: 500 })

  const force = new URL(request.url).searchParams.get('force') === '1'
  const client = serviceClient()

  const { data: profile } = await client
    .from('agent_profiles').select('cloned_voice_id, liveavatar_voice_id, name').eq('user_id', user.id).maybeSingle()

  if (!profile?.cloned_voice_id) {
    return NextResponse.json({ error: 'Ingen klonet stemme å binde. Klon stemmen din først.' }, { status: 400 })
  }
  if (profile.liveavatar_voice_id && !force) {
    return NextResponse.json({ voice_id: profile.liveavatar_voice_id, alreadyBound: true })
  }

  const res = await fetch('https://api.liveavatar.com/v1/voices/third_party', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      provider_voice_id: profile.cloned_voice_id,
      secret_id: secretId,
      name: `${profile.name || 'Megler'} (klonet)`.slice(0, 60),
    }),
  })
  const data = await res.json().catch(() => ({}))
  const voiceId = data?.data?.voice_id || data?.data?.id
  if (!res.ok || !voiceId) {
    return NextResponse.json({ error: `LiveAvatar-binding feilet: ${data?.message || res.status}` }, { status: 502 })
  }

  await client.from('agent_profiles').upsert(
    { user_id: user.id, liveavatar_voice_id: voiceId }, { onConflict: 'user_id' },
  )

  return NextResponse.json({ voice_id: voiceId })
}
