import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const WORKER_URL = 'http://139.59.212.218:3003'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const { propertyId, script, voiceId, avatarImageUrl, propertyImages } = await request.json()

    if (!script || !voiceId || !avatarImageUrl) {
      return NextResponse.json({ error: 'Mangler script, voiceId eller avatarImageUrl' }, { status: 400 })
    }

    const jobId = randomUUID()

    // Create a pending job record in Supabase so it shows up immediately
    if (propertyId) {
      await getSupabase().from('production_jobs').insert({
        id: jobId,
        property_id: propertyId,
        script,
        status: 'queued',
      })
    }

    // Dispatch to droplet worker — returns immediately
    const workerRes = await fetch(`${WORKER_URL}/jobs/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        propertyId,
        avatarImageUrl,
        scriptText: script,
        voiceId,
        imageUrls: (propertyImages || []).slice(0, 8),
      }),
    })

    if (!workerRes.ok) {
      const err = await workerRes.json().catch(() => ({ error: 'Worker feil' }))
      return NextResponse.json({ error: err.error || 'Worker feilet ved oppstart' }, { status: 500 })
    }

    return NextResponse.json({ jobId, status: 'queued' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
