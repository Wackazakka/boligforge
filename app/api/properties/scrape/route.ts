import { NextResponse } from 'next/server'

const SCRAPER_URL = 'http://139.59.212.218:3003'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()
    if (!url?.includes('finn.no')) {
      return NextResponse.json({ error: 'Ugyldig Finn.no-URL' }, { status: 400 })
    }

    // Droplet handles scraping, image re-hosting to R2, and saving to Supabase
    const scraperRes = await fetch(`${SCRAPER_URL}/scrape-save?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(120000),
    })

    if (!scraperRes.ok) {
      const err = await scraperRes.json().catch(() => ({ error: 'Scraper feilet' }))
      return NextResponse.json({ error: err.error || 'Scraper feilet' }, { status: 500 })
    }

    const row = await scraperRes.json()
    if (row.error) return NextResponse.json({ error: row.error }, { status: 500 })

    return NextResponse.json(row)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
