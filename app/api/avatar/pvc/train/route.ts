// Starter PVC-trening (fine-tuning). Tar 2–6 timer; status-ruten poller resultatet.

import { NextResponse } from 'next/server'
import { getUser } from '../../../../../lib/supabase/server'
import { readPvcState, writePvcState, elJson } from '../../../../../lib/avatar/pvc'

export const runtime = 'nodejs'

export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const state = await readPvcState(user.id)
  if (!state?.voice_id) return NextResponse.json({ error: 'Start PVC først' }, { status: 400 })

  const { ok, status, data } = await elJson(`/v1/voices/pvc/${state.voice_id}/train`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model_id: 'eleven_multilingual_v2' }),
  })
  if (!ok) {
    const msg = (data as { detail?: { message?: string } })?.detail?.message || JSON.stringify(data)
    return NextResponse.json({ error: `Trening kunne ikke startes (${status}): ${String(msg).slice(0, 200)}` }, { status: 502 })
  }

  await writePvcState(user.id, { ...state, status: 'training' })
  return NextResponse.json({ ok: true, status: 'training' })
}
