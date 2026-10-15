import { NextResponse } from 'next/server'
import { fetchHjemListing, maskEmail } from '../../../../lib/hjem'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Steg 1 i Hjem.no-inngangen (offentlig): slå opp annonsen og vis kontor og
// meglere, så megleren kan peke på seg selv. E-postene maskeres; selve
// utsendingen går via ../send-lenke, som slår opp annonsen på nytt.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { url?: unknown }
  const url = typeof body.url === 'string' ? body.url : ''
  const listing = await fetchHjemListing(url).catch(() => null)
  if (!listing) {
    return NextResponse.json({ error: 'Fant ikke annonsen. Lim inn lenken til en annonse på hjem.no, f.eks. https://hjem.no/property/123456/abc…' }, { status: 404 })
  }
  return NextResponse.json({
    listing: { url: listing.url, title: listing.title, address: listing.address },
    agency: listing.agency ? { name: listing.agency.name, logoUrl: listing.agency.logoUrl } : null,
    contacts: listing.contacts.map((c, index) => ({
      index,
      name: c.name,
      position: c.position,
      image: c.image,
      emailMasked: c.email ? maskEmail(c.email) : null,
      harEpost: !!c.email,
    })),
  })
}
