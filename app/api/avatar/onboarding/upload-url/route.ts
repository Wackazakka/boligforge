// Signert opplastings-URL for video-avatar-opptak. Klienten laster videoen direkte
// til Supabase Storage (omgår Netlifys ~4,5 MB-grense; video er stor).

import { NextResponse } from 'next/server'
import { getUser } from '../../../../../lib/supabase/server'
import { serviceClient } from '../../../../../lib/avatar/rag'

export const runtime = 'nodejs'
const BUCKET = 'liveavatar-onboarding'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ext = (new URL(request.url).searchParams.get('ext') || 'webm').replace(/[^a-z0-9]/gi, '')
  const client = serviceClient()
  const path = `${user.id}/avatar-video.${ext}`

  // Fjern evt. tidligere opptak så re-opptak overskriver rent
  await client.storage.from(BUCKET).remove([
    `${user.id}/avatar-video.webm`, `${user.id}/avatar-video.mp4`, `${user.id}/avatar-video.mov`,
  ]).catch(() => {})

  const { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) return NextResponse.json({ error: `Signert URL feilet: ${error.message}` }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl, token: data.token, path: data.path })
}
