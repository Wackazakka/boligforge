// LiveAvatar (FULL-modus) sesjons-token for digital visning. Bruker meglerens
// video-avatar + klonede stemme, og ruter samtalen til vår Claude/RAG-adapter
// (llm_configuration_id) med boligens property_id som dynamic_variables.

import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'
import { serviceClient } from '../../../../lib/avatar/rag'

export const runtime = 'nodejs'

const LA_BASE = 'https://api.liveavatar.com'

async function agentProfile(client: ReturnType<typeof serviceClient>, userId: string) {
  const { data } = await client
    .from('agent_profiles')
    .select('liveavatar_avatar_id, liveavatar_voice_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const propertyId = new URL(request.url).searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'Mangler propertyId' }, { status: 400 })

  const client = serviceClient()
  const { data: property } = await client
    .from('properties').select('agent_id, user_id, address').eq('id', propertyId).maybeSingle()
  if (!property) return NextResponse.json({ error: 'Ukjent eiendom' }, { status: 404 })

  // Meglerens profil: boligens agent_id eller eier (user_id), med innlogget bruker som siste fallback.
  const megler = property.agent_id || property.user_id
  let profile = megler ? await agentProfile(client, megler) : null
  if (!profile?.liveavatar_avatar_id) profile = await agentProfile(client, user.id)
  if (!profile?.liveavatar_avatar_id) {
    return NextResponse.json({ error: 'Denne megleren har ingen LiveAvatar-avatar' }, { status: 400 })
  }

  const key = process.env.LIVEAVATAR_API_KEY
  const llmConfigId = process.env.LIVEAVATAR_LLM_CONFIG_ID
  const contextId = process.env.LIVEAVATAR_CONTEXT_ID
  if (!key || !llmConfigId || !contextId) {
    return NextResponse.json({ error: 'LiveAvatar-konfig mangler på serveren' }, { status: 500 })
  }

  const voiceId = profile.liveavatar_voice_id || process.env.AVATAR_VOICE_ID || undefined

  const res = await fetch(`${LA_BASE}/v1/sessions/token`, {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'FULL',
      avatar_id: profile.liveavatar_avatar_id,
      llm_configuration_id: llmConfigId,
      dynamic_variables: {
        property_id: propertyId,
        address: property.address || '',
      },
      avatar_persona: {
        ...(voiceId && { voice_id: voiceId }),
        context_id: contextId,
        language: 'no',
        ...(voiceId && {
          voice_settings: { model: 'eleven_flash_v2_5', stability: 0.75, similarity_boost: 0.75, speed: 1.0 },
        }),
      },
      interactivity_type: 'CONVERSATIONAL',
    }),
  })

  const data = await res.json()
  const sessionToken = data?.data?.session_token
  if (!sessionToken) {
    console.error('[liveavatar-token] feilet:', data)
    return NextResponse.json({ error: data?.message || 'Token-oppretting feilet' }, { status: res.status })
  }
  return NextResponse.json({ session_token: sessionToken, session_id: data.data.session_id })
}
