import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUser } from '../../../../lib/supabase/server'

// Formatkonvertering av ferdig video: 16:9 → 9:16 (Reels/Stories) eller 1:1.
// Worker-en gjør jobben (nedskalering + sorte felter, ingen beskjæring) og
// statusen polles via samme /api/video/status/[jobId] som vanlige videojobber.
// Gratis — avledet format av en allerede betalt video.

export const runtime = 'nodejs'

const WORKER_URL = 'http://139.59.212.218:3003'

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { videoUrl, format } = await request.json()
    const publicBase = process.env.R2_PUBLIC_URL || 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev'
    if (!videoUrl || !String(videoUrl).startsWith(publicBase)) {
      return NextResponse.json({ error: 'Ugyldig videoUrl' }, { status: 400 })
    }
    if (format !== 'portrait' && format !== 'square') {
      return NextResponse.json({ error: 'format må være portrait eller square' }, { status: 400 })
    }

    const jobId = randomUUID()
    const workerRes = await fetch(`${WORKER_URL}/jobs/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, videoUrl, format }),
    })
    if (!workerRes.ok) {
      const err = await workerRes.json().catch(() => ({}))
      return NextResponse.json({ error: err.error || 'Konvertering kunne ikke startes' }, { status: 502 })
    }

    return NextResponse.json({ jobId, status: 'queued' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
