import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WORKER_URL = 'http://139.59.212.218:3003'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jvnavubholyvihvytqkn.supabase.co'

function getServiceClient() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Worker-genererte feilmeldinger som er kryptiske for sluttbruker oversettes til
// noe forståelig. Disse feilene stammer fra video-workeren på dropleten
// (139.59.212.218), IKKE fra BoligForge-appen.
function translateWorkerError(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  if (raw.includes('supabaseUrl is required')) {
    return 'Video-tjenesten er feilkonfigurert (mangler Supabase-URL på serveren). Kontakt support.'
  }
  return raw
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  try {
    const res = await fetch(`${WORKER_URL}/jobs/video/${jobId}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      return NextResponse.json({ status: 'unknown', error: 'Worker svarte ikke' }, { status: 502 })
    }
    const data = await res.json()
    if (data && typeof data === 'object' && 'error' in data) {
      return NextResponse.json({ ...data, error: translateWorkerError(data.error) })
    }

    // When done, persist the video URL to property_videos so history shows it
    if (data?.status === 'done' && data?.videoUrl) {
      getServiceClient()
        .from('property_videos')
        .update({ video_url: data.videoUrl })
        .eq('id', jobId)
        .eq('video_url', '')   // only update if still empty (idempotent)
        .then(({ error }) => { if (error) console.warn('[status] property_videos update:', error.message) })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ status: 'unknown', error: msg }, { status: 502 })
  }
}
