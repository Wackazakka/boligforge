// Avgjør avatar-leverandør for en bolig, med respekt for byråets toggles:
//   liveavatar-avatar + byrå tillater video → 'liveavatar'
//   ellers byrå tillater foto → 'did'
//   ellers → 'none' (digital visning avskrudd av byråsjef)
// Lett, ugatet oppslag — brukes av den offentlige visning-siden.

import { NextResponse } from 'next/server'
import { serviceClient } from '../../../../lib/avatar/rag'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const propertyId = new URL(request.url).searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ provider: 'did' })

  const client = serviceClient()
  const { data: property } = await client
    .from('properties')
    .select('agent_id, user_id, address, images, price, price_total, bedrooms, property_type, size_bra, build_year')
    .eq('id', propertyId).maybeSingle()
  const megler = property?.agent_id || property?.user_id
  if (!megler) return NextResponse.json({ provider: 'did' })

  const { data: profile } = await client
    .from('agent_profiles').select('liveavatar_avatar_id').eq('user_id', megler).maybeSingle()
  const hasLiveAvatar = !!profile?.liveavatar_avatar_id

  // Byrå-flagg (default tillatt hvis ingen org / kolonner mangler ennå)
  let allowDid = true, allowLive = true
  try {
    const { data: m } = await client
      .from('organization_members').select('organization_id').eq('user_id', megler).maybeSingle()
    if (m?.organization_id) {
      const { data: org } = await client
        .from('organizations').select('allow_did, allow_liveavatar').eq('id', m.organization_id).maybeSingle()
      if (org) { allowDid = org.allow_did ?? true; allowLive = org.allow_liveavatar ?? true }
    }
  } catch { /* kolonner mangler → behold default true */ }

  let provider: 'liveavatar' | 'did' | 'none' = 'none'
  if (hasLiveAvatar && allowLive) provider = 'liveavatar'
  else if (allowDid) provider = 'did'

  // Lite fakta-kort til de offentlige kjøpersidene (bolig-chat / avatar-samtale)
  const images = Array.isArray(property?.images) ? property.images : []
  return NextResponse.json({
    provider,
    address: property?.address || '',
    card: {
      image: typeof images[0] === 'string' ? images[0] : null,
      price: property?.price_total ?? property?.price ?? null,
      bedrooms: property?.bedrooms ?? null,
      propertyType: property?.property_type ?? null,
      sizeBra: property?.size_bra ?? null,
      buildYear: property?.build_year ?? null,
    },
  })
}
