// Avgjør avatar-leverandør for en bolig: 'liveavatar' hvis meglerens profil har
// en liveavatar_avatar_id, ellers 'did' (foto-avataren). Lett, ugatet oppslag —
// brukes av visning-siden for å velge riktig flyt.

import { NextResponse } from 'next/server'
import { serviceClient } from '../../../../lib/avatar/rag'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const propertyId = new URL(request.url).searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ provider: 'did' })

  const client = serviceClient()
  const { data: property } = await client
    .from('properties').select('agent_id, user_id').eq('id', propertyId).maybeSingle()

  const megler = property?.agent_id || property?.user_id
  let hasLiveAvatar = false
  if (megler) {
    const { data: profile } = await client
      .from('agent_profiles').select('liveavatar_avatar_id').eq('user_id', megler).maybeSingle()
    hasLiveAvatar = !!profile?.liveavatar_avatar_id
  }
  return NextResponse.json({ provider: hasLiveAvatar ? 'liveavatar' : 'did' })
}
