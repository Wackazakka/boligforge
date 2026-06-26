// Oppretter (eller resumer) meglerens PVC-stemme. Resume hindrer at vi brenner
// en ny ElevenLabs-stemme-slot hvis flyten startes på nytt.

import { NextResponse } from 'next/server'
import { getUser } from '../../../../../lib/supabase/server'
import { serviceClient } from '../../../../../lib/avatar/rag'
import { elJson, readPvcState, writePvcState } from '../../../../../lib/avatar/pvc'

export const runtime = 'nodejs'

export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await readPvcState(user.id)
  if (existing?.voice_id) {
    return NextResponse.json({ voice_id: existing.voice_id, status: existing.status, resumed: true })
  }

  const client = serviceClient()
  const { data: profile } = await client
    .from('agent_profiles').select('name').eq('user_id', user.id).maybeSingle()
  const name = `${profile?.name || 'Megler'} (PVC)`.slice(0, 60)

  const { ok, status, data } = await elJson('/v1/voices/pvc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, language: 'no' }),
  })
  const voiceId = (data as { voice_id?: string })?.voice_id
  if (!ok || !voiceId) {
    const msg = (data as { detail?: { message?: string } })?.detail?.message || JSON.stringify(data)
    return NextResponse.json({ error: `PVC-oppretting feilet (${status}): ${msg}`.slice(0, 300) }, { status: 502 })
  }

  const state = { voice_id: voiceId, status: 'samples' as const, sample_count: 0, created_at: new Date().toISOString() }
  await writePvcState(user.id, state)
  return NextResponse.json({ voice_id: voiceId, status: 'samples' })
}
