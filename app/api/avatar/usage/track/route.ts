// Heartbeat + avslutning for en avatar-sesjon. Server beregner varighet fra
// started_at (server-autoritativt), så varigheten holder selv om fanen lukkes
// (siste heartbeat blir varigheten). ended=true finaliserer.

import { NextResponse } from 'next/server'
import { serviceClient } from '../../../../../lib/avatar/rag'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { sessionId, ended } = await request.json().catch(() => ({}))
  if (!sessionId) return NextResponse.json({ error: 'Mangler sessionId' }, { status: 400 })

  const client = serviceClient()
  const { data: row } = await client
    .from('reelhome_avatar_usage').select('started_at').eq('id', sessionId).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Ukjent sesjon' }, { status: 404 })

  const now = new Date()
  const duration = Math.max(0, Math.round((now.getTime() - new Date(row.started_at).getTime()) / 1000))

  const update: Record<string, unknown> = { last_seen_at: now.toISOString(), duration_seconds: duration }
  if (ended) update.ended_at = now.toISOString()

  await client.from('reelhome_avatar_usage').update(update).eq('id', sessionId)
  return NextResponse.json({ ok: true, duration_seconds: duration })
}
