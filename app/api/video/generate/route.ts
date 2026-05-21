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
    const { propertyId, script, voiceId, avatarImageUrl, portraitUrl, propertyImages, segments, outro } = await request.json()

    const useSegments = Array.isArray(segments) && segments.length > 0
    if (!useSegments && (!script || !voiceId || !avatarImageUrl)) {
      return NextResponse.json({ error: 'Mangler script, voiceId eller avatarImageUrl' }, { status: 400 })
    }
    if (useSegments && (!voiceId || !avatarImageUrl)) {
      return NextResponse.json({ error: 'Mangler voiceId eller avatarImageUrl' }, { status: 400 })
    }

    const jobId = randomUUID()
    const scriptText = useSegments ? segments.map((s: { text: string }) => s.text).join(' ') : script

    // Create a pending job record in Supabase (best-effort — don't block if table missing)
    if (propertyId) {
      getSupabase().from('production_jobs').insert({
        id: jobId,
        property_id: propertyId,
        script: scriptText,
        status: 'queued',
      }).then(({ error }) => { if (error) console.warn('[video/generate] production_jobs insert:', error.message) })
    }

    // Dispatch to droplet worker — returns immediately
    const workerRes = await fetch(`${WORKER_URL}/jobs/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(useSegments
        ? { jobId, propertyId, avatarImageUrl, portraitUrl, voiceId, segments, outro }
        : { jobId, propertyId, avatarImageUrl, scriptText: script, voiceId, imageUrls: (propertyImages || []).slice(0, 8) }
      ),
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
