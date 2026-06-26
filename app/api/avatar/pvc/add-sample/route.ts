// Videresender et opplastet lydeksempel fra storage til ElevenLabs PVC-stemmen.
// Server→ElevenLabs (utgående) er ikke underlagt Netlifys 4,5 MB inn-grense.

import { NextResponse } from 'next/server'
import { getUser } from '../../../../../lib/supabase/server'
import { serviceClient } from '../../../../../lib/avatar/rag'
import { readPvcState, writePvcState, elKey, PVC_BUCKET } from '../../../../../lib/avatar/pvc'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = await readPvcState(user.id)
  if (!state?.voice_id) return NextResponse.json({ error: 'Start PVC først' }, { status: 400 })

  const { path } = await request.json().catch(() => ({}))
  if (!path || !String(path).startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Ugyldig sti' }, { status: 400 })
  }

  const client = serviceClient()
  const { data: blob, error } = await client.storage.from(PVC_BUCKET).download(path)
  if (error || !blob) return NextResponse.json({ error: 'Fant ikke opplastet lyd' }, { status: 404 })

  const filename = String(path).split('/').pop() || 'sample.webm'
  const fd = new FormData()
  fd.append('files', blob, filename)
  fd.append('remove_background_noise', 'true')

  const res = await fetch(`https://api.elevenlabs.io/v1/voices/pvc/${state.voice_id}/samples`, {
    method: 'POST', headers: { 'xi-api-key': elKey() }, body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.detail?.message || JSON.stringify(data)
    return NextResponse.json({ error: `Eksempel avvist (${res.status}): ${String(msg).slice(0, 200)}` }, { status: 502 })
  }

  // Rydd opp i storage — ElevenLabs har lyden nå
  await client.storage.from(PVC_BUCKET).remove([path]).catch(() => {})

  const added = Array.isArray(data) ? data.length : 1
  const newState = { ...state, sample_count: (state.sample_count || 0) + added }
  await writePvcState(user.id, newState)

  return NextResponse.json({ ok: true, sample_count: newState.sample_count })
}
