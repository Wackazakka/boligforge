// D-ID Streams API — oppretter og lukker en WebRTC-strøm for interaktiv avatar.
// Henter meglerens profilbilde og stemmeklone fra agent_profiles.

import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'
import { serviceClient } from '../../../../lib/avatar/rag'

export const runtime = 'nodejs'

const DID_BASE = 'https://api.d-id.com'

function didHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${process.env.DID_API_KEY}`,
    Accept: 'application/json',
  }
}

async function getAgentProfile(userId: string) {
  const supabase = serviceClient()
  const { data } = await supabase
    .from('agent_profiles')
    .select('portrait_url, cloned_voice_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

// POST — opprett D-ID stream. Query-param: ?propertyId=xxx
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('propertyId')

  const supabase = serviceClient()
  let portraitUrl: string | null = null
  let voiceId = process.env.DID_VOICE_ID ?? null

  if (propertyId) {
    const { data: property } = await supabase
      .from('properties')
      .select('agent_id')
      .eq('id', propertyId)
      .maybeSingle()

    if (property?.agent_id) {
      const profile = await getAgentProfile(property.agent_id)
      if (profile?.portrait_url) portraitUrl = profile.portrait_url
      if (process.env.DID_PER_MEGLER_VOICE === '1' && profile?.cloned_voice_id) {
        voiceId = profile.cloned_voice_id
      }
    }
  }

  // Fallback: bruk innlogget brukers egen profil (megler tester selv)
  if (!portraitUrl) {
    const profile = await getAgentProfile(user.id)
    if (profile?.portrait_url) portraitUrl = profile.portrait_url
    if (process.env.DID_PER_MEGLER_VOICE === '1' && profile?.cloned_voice_id) {
      voiceId = profile.cloned_voice_id
    }
  }

  if (!portraitUrl) {
    return NextResponse.json({ error: 'Ingen profilbilde funnet — last opp et bilde i profilen din' }, { status: 400 })
  }

  const res = await fetch(`${DID_BASE}/talks/streams`, {
    method: 'POST',
    headers: didHeaders(),
    body: JSON.stringify({
      source_url: portraitUrl,
      driver_url: 'bank://lively/driver-03',
      config: { stitch: true },
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('[did-stream] opprettelse feilet:', data)
    return NextResponse.json({ error: data.description ?? data.message ?? 'D-ID stream feilet' }, { status: res.status })
  }

  return NextResponse.json({
    stream_id: data.id,
    session_id: data.session_id,
    offer: data.offer,
    ice_servers: data.ice_servers,
    voice_id: voiceId,
  })
}

// DELETE — lukk D-ID stream
export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stream_id, session_id } = await request.json()
  if (!stream_id || !session_id) return NextResponse.json({ ok: true })

  try {
    await fetch(`${DID_BASE}/talks/streams/${stream_id}`, {
      method: 'DELETE',
      headers: didHeaders(),
      body: JSON.stringify({ session_id }),
    })
  } catch (e) {
    console.warn('[did-stream] lukking feilet (ignorert):', e)
  }

  return NextResponse.json({ ok: true })
}
