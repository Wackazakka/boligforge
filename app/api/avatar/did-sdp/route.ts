import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stream_id, session_id, answer } = await request.json()
  if (!stream_id || !session_id || !answer) {
    return NextResponse.json({ error: 'Mangler stream_id, session_id eller answer' }, { status: 400 })
  }

  const res = await fetch(`https://api.d-id.com/talks/streams/${stream_id}/sdp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${process.env.DID_API_KEY}`,
    },
    body: JSON.stringify({ answer, session_id }),
  })

  if (!res.ok) {
    const data = await res.json()
    return NextResponse.json({ error: data.description ?? data.message }, { status: res.status })
  }

  return NextResponse.json({ ok: true })
}
