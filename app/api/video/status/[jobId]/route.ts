import { NextResponse } from 'next/server'

const WORKER_URL = 'http://139.59.212.218:3003'

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
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ status: 'unknown', error: msg }, { status: 502 })
  }
}
