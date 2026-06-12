// Megler-styring av AI-megler-porten (Spor C). GET leser config, POST upserter.
import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'
import { serviceClient } from '../../../../lib/avatar/rag'

export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const propertyId = new URL(request.url).searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'Mangler propertyId' }, { status: 400 })
  const svc = serviceClient()
  const { data } = await svc.from('reelhome_avatar_config').select('*').eq('property_id', propertyId).maybeSingle()
  return NextResponse.json(data ?? null)
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = await request.json()
  if (!b.propertyId) return NextResponse.json({ error: 'Mangler propertyId' }, { status: 400 })
  const svc = serviceClient()
  const { error } = await svc.from('reelhome_avatar_config').upsert({
    property_id: b.propertyId,
    user_id: user.id,
    enabled: !!b.enabled,
    gate_mode: ['consent', 'contact', 'viewing'].includes(b.gate_mode) ? b.gate_mode : 'contact',
    viewing_date: b.viewing_date || null,
    token_expiry_hours: b.token_expiry_hours ?? 48,
    max_session_minutes: b.max_session_minutes ?? 15,
    max_sessions_per_buyer: b.max_sessions_per_buyer ?? 2,
    max_buyers: b.max_buyers ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'property_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
