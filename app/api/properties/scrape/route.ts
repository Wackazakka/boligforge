import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const SCRAPER_URL = 'http://139.59.212.218:3003'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function getR2() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

// Download a Finn.no image via the scraper VPS (which can access Finn.no CDN)
// and re-host it on R2 for permanent, unrestricted access.
async function rehostImage(finnUrl: string, index: number): Promise<string> {
  try {
    const proxyUrl = `${SCRAPER_URL}/image?url=${encodeURIComponent(finnUrl)}`
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return finnUrl // fallback to original URL

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return finnUrl

    const buffer = Buffer.from(await res.arrayBuffer())
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const key = `boligforge/properties/${Date.now()}_${index}.${ext}`

    await getR2().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'contentforge-assets',
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }))

    return `${process.env.R2_PUBLIC_URL}/${key}`
  } catch {
    return finnUrl // fallback silently
  }
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

    // Re-host images to R2 via scraper VPS (Netlify can't fetch Finn.no CDN directly)
    const finnImages: string[] = data.images || []
    const rehostedImages = await Promise.all(
      finnImages.map((imgUrl, i) => rehostImage(imgUrl, i))
    )

    const supabase = getSupabase()

    // Upsert on finn_id so re-scraping updates existing row
    const { data: row, error } = await supabase
      .from('properties')
      .upsert(
        {
          finn_id: data.finnId,
          address: data.address,
          title: data.title,
          summary: data.summary,
          price: data.price,
          price_total: data.priceTotal,
          shared_debt: data.sharedDebt,
          shared_costs: data.sharedCosts,
          size_bra: data.sizeBra,
          size_total: data.sizeTotal,
          rooms: data.rooms,
          bedrooms: data.bedrooms,
          floor: data.floor,
          build_year: data.buildYear,
          property_type: data.propertyType,
          ownership_type: data.ownershipType,
          energy_label: data.energyLabel,
          plot_area: data.plotArea,
          plot_owned: data.plotOwned,
          facilities: data.facilities,
          description: data.description,
          property_info_text: data.propertyInfoText,
          images: rehostedImages,
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
