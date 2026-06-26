// PVC-status. Poller ElevenLabs fine_tuning.state. Når fine_tuned: binder stemmen
// til LiveAvatar og setter den som meglerens stemme (cloned + liveavatar).

import { NextResponse } from 'next/server'
import { getUser } from '../../../../../lib/supabase/server'
import { serviceClient } from '../../../../../lib/avatar/rag'
import { readPvcState, writePvcState, elJson, bindToLiveAvatar } from '../../../../../lib/avatar/pvc'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const state = await readPvcState(user.id)
  if (!state?.voice_id) return NextResponse.json({ status: 'none' })

  // Allerede ferdig + bundet
  if (state.status === 'ready') {
    return NextResponse.json({ status: 'ready', sample_count: state.sample_count, liveavatar_voice_id: state.liveavatar_voice_id })
  }

  const { ok, data } = await elJson(`/v1/voices/${state.voice_id}`)
  const ft = (data as { fine_tuning?: { state?: Record<string, string>; verification_attempts_count?: number } })?.fine_tuning
  const states = Object.values(ft?.state || {})
  const fineTuned = states.includes('fine_tuned')
  const failed = states.includes('failed')
  const inProgress = states.some(s => ['fine_tuning', 'queued', 'delayed'].includes(s))

  // Ferdig trent → bind til LiveAvatar + sett som meglerens stemme
  if (ok && fineTuned) {
    const client = serviceClient()
    const { data: profile } = await client.from('agent_profiles').select('name').eq('user_id', user.id).maybeSingle()
    const laVoiceId = await bindToLiveAvatar(state.voice_id, `${profile?.name || 'Megler'} (PVC)`)
    await client.from('agent_profiles').upsert({
      user_id: user.id,
      cloned_voice_id: state.voice_id,
      default_voice_id: state.voice_id,
      ...(laVoiceId ? { liveavatar_voice_id: laVoiceId } : {}),
    }, { onConflict: 'user_id' })
    await writePvcState(user.id, { ...state, status: 'ready', liveavatar_voice_id: laVoiceId || undefined })
    return NextResponse.json({ status: 'ready', liveavatar_voice_id: laVoiceId, sample_count: state.sample_count })
  }

  const phase = failed ? 'failed' : inProgress ? 'training' : state.status
  return NextResponse.json({
    status: phase, sample_count: state.sample_count,
    fineTuning: ft?.state || {}, verification_attempts: ft?.verification_attempts_count ?? 0,
  })
}
