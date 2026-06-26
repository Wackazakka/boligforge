// Signert opplastings-URL for et PVC-lydeksempel. Klienten laster lyden direkte til
// storage (store filer / lang lyd omgår Netlifys body-grense), så videresender
// add-sample den server-side til ElevenLabs.

import { NextResponse } from 'next/server'
import { getUser } from '../../../../../lib/supabase/server'
import { serviceClient } from '../../../../../lib/avatar/rag'
import { readPvcState, PVC_BUCKET } from '../../../../../lib/avatar/pvc'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = await readPvcState(user.id)
  if (!state?.voice_id) return NextResponse.json({ error: 'Start PVC først' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const raw = String(body.filename || `sample-${Date.now()}.webm`)
  const safe = raw.replace(/[^a-z0-9._-]/gi, '_').slice(-80)
  const path = `${user.id}/pvc-samples/${safe}`

  const client = serviceClient()
  await client.storage.from(PVC_BUCKET).remove([path]).catch(() => {})
  const { data, error } = await client.storage.from(PVC_BUCKET).createSignedUploadUrl(path)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl, path: data.path, filename: safe })
}
