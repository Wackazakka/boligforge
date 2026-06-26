import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stream_id, session_id, candidate, sdpMid, sdpMLineIndex } = await request.json()
  if (!stream_id || !session_id) {
    return NextResponse.json({ error: 'Mangler stream_id eller session_id' }, { status: 400 })
  }

  const res = await fetch(`https://api.d-id.com/talks/streams/${stream_id}/ice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${process.env.DID_API_KEY}`,
    },
    body: JSON.stringify({ candidate, sdpMid, sdpMLineIndex, session_id }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    console.warn('[did-ice] feilet:', data)
  }

  return NextResponse.json({ ok: true })
}
