import { NextResponse } from 'next/server'

const WORKER_URL = 'http://139.59.212.218:3003'

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
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ status: 'unknown', error: msg }, { status: 502 })
  }
}
