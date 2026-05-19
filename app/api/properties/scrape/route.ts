import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SCRAPER_URL = 'http://139.59.212.218:3003'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()
    if (!url?.includes('finn.no')) {
      return NextResponse.json({ error: 'Ugyldig Finn.no-URL' }, { status: 400 })
    }

    const scraperRes = await fetch(`${SCRAPER_URL}/scrape?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(25000),
    })

    if (!scraperRes.ok) {
      const err = await scraperRes.json().catch(() => ({ error: 'Scraper feilet' }))
      return NextResponse.json({ error: err.error || 'Scraper feilet' }, { status: 500 })
    }

    const data = await scraperRes.json()
    if (data.error) return NextResponse.json({ error: data.error }, { status: 500 })

    const supabase = getSupabase()

    // Upsert on finn_id so re-scraping updates existing row
    const { data: row, error } = await supabase
      .from('properties')
      .upsert(
        {
          finn_id: data.finnId,
          address: data.address,
          price: data.price,
          size_bra: data.sizeBra,
          rooms: data.rooms,
          build_year: data.buildYear,
          description: data.description,
          images: data.images,
          viewing_dates: data.viewingDates,
          finn_url: url,
        },
        { onConflict: 'finn_id' }
      )
      .select('id, finn_id, address, price, size_bra, rooms, images')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(row)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
