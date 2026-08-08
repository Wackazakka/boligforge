import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'

const SCRAPER_URL = 'http://139.59.212.218:3003'

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { url } = await request.json()
    if (!url?.includes('finn.no') && !url?.includes('hjem.no')) {
      return NextResponse.json({ error: 'Ugyldig URL — kun Finn.no og Hjem.no støttes' }, { status: 400 })
    }

    // Asynkront: worker svarer umiddelbart med scrapeId, klienten poller GET
    // under. (Synkron venting røk i Netlify-taket på ~26 s — hjem.no-scrape
    // med 30 bilder + energimerke-oppslag tar lengre tid enn det.)
    const scraperRes = await fetch(
      `${SCRAPER_URL}/scrape-save-async?url=${encodeURIComponent(url)}&user_id=${encodeURIComponent(user.id)}`,
      { signal: AbortSignal.timeout(15000) }
    )

    if (!scraperRes.ok) {
      const err = await scraperRes.json().catch(() => ({ error: 'Scraper feilet' }))
      return NextResponse.json({ error: err.error || 'Scraper feilet' }, { status: 500 })
    }

    return NextResponse.json(await scraperRes.json())
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Statuspoll for pågående scrape (proxy mot worker)
export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'Ugyldig id' }, { status: 400 })
  try {
    const res = await fetch(`${SCRAPER_URL}/scrape-status?id=${id}`, { signal: AbortSignal.timeout(10000) })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
