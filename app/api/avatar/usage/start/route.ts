// Starter en avatar-sesjon for måling. Treffes av anonyme besøkende på visningssiden,
// så ingen auth — megleren som faktureres utledes server-side fra eiendommen.

import { NextResponse } from 'next/server'
import { serviceClient } from '../../../../../lib/avatar/rag'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { propertyId, provider, visitorSession } = await request.json().catch(() => ({}))
  if (!propertyId || !['liveavatar', 'did'].includes(provider)) {
    return NextResponse.json({ error: 'Mangler propertyId/provider' }, { status: 400 })
  }

  const client = serviceClient()
  const { data: prop } = await client
    .from('properties').select('id, user_id, agent_id').eq('id', propertyId).maybeSingle()
  if (!prop) return NextResponse.json({ error: 'Ukjent eiendom' }, { status: 404 })

  const megler = prop.agent_id || prop.user_id
  const { data: row, error } = await client
    .from('reelhome_avatar_usage')
    .insert({ property_id: propertyId, user_id: megler, provider, visitor_session: visitorSession || null })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sessionId: row.id })
}
