// PVC-verifisering. GET henter captcha-utfordringen (format udokumentert — vi
// returnerer rått, enten JSON, tekst eller bilde). POST sender brukerens opptak av
// utfordringen til ElevenLabs (felt "recording").

import { NextResponse } from 'next/server'
import { getUser } from '../../../../../lib/supabase/server'
import { readPvcState, writePvcState, elKey } from '../../../../../lib/avatar/pvc'

export const runtime = 'nodejs'
const EL = 'https://api.elevenlabs.io'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const state = await readPvcState(user.id)
  if (!state?.voice_id) return NextResponse.json({ error: 'Start PVC først' }, { status: 400 })

  const res = await fetch(`${EL}/v1/voices/pvc/${state.voice_id}/captcha`, { headers: { 'xi-api-key': elKey() } })
  const ct = res.headers.get('content-type') || ''

  if (ct.includes('application/json')) {
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: res.ok, contentType: ct, data })
  }
  if (ct.startsWith('image/')) {
    const buf = Buffer.from(await res.arrayBuffer())
    return NextResponse.json({ ok: res.ok, contentType: ct, image: `data:${ct};base64,${buf.toString('base64')}` })
  }
  const text = await res.text()
  return NextResponse.json({ ok: res.ok, contentType: ct, text })
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const state = await readPvcState(user.id)
  if (!state?.voice_id) return NextResponse.json({ error: 'Start PVC først' }, { status: 400 })

  const inForm = await request.formData().catch(() => null)
  const recording = inForm?.get('recording') as File | null
  if (!recording) return NextResponse.json({ error: 'Mangler verifiserings-opptak' }, { status: 400 })

  const fd = new FormData()
  fd.append('recording', recording, 'verification.webm')
  const res = await fetch(`${EL}/v1/voices/pvc/${state.voice_id}/captcha`, {
    method: 'POST', headers: { 'xi-api-key': elKey() }, body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.detail?.message || JSON.stringify(data)
    return NextResponse.json({ error: `Verifisering feilet (${res.status}): ${String(msg).slice(0, 200)}` }, { status: 502 })
  }

  await writePvcState(user.id, { ...state, status: 'verifying' })
  return NextResponse.json({ ok: true, data })
}
