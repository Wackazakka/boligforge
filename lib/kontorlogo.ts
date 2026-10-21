import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { fetchHjemListing } from './hjem'

// Kontorets logo per bolig (21/10, hjem.no-modellen): Hjem.nos produsenter
// lager videoer for mange kontorer fra én konto, så sluttplakatens logo må
// følge BOLIGEN, ikke kontoen som lager videoen. Logoen hentes fra annonsen
// på hjem.no første gang den trengs og lagres på boligen (properties.
// kontor_logo_url / kontor_navn). Kontoens egen logo vinner alltid når den
// finnes — dette er reserven for kontoer uten logo.
//
// hjem.no leverer kontorlogoene som SVG (f.eks. Privatmegleren_primary.svg).
// Workeren legger logoen på plakaten med ffmpeg, som ikke leser SVG, så fila
// rastreres til PNG med sharp og legges på vår R2 først. Det gjøres for alle
// formater, så workeren alltid får en PNG den eier selv.

export type KontorLogo = { logoUrl: string; navn: string | null }

type PropRow = { id: string; hjem_url: string | null; kontor_logo_url: string | null; kontor_navn: string | null }

/**
 * Returnerer kontorlogoen for boligen, eller null når boligen ikke er fra
 * hjem.no eller annonsen ikke har noen logo. Feiler oppslaget eller
 * rastreringen, lagres ingenting, så neste forsøk prøver igjen.
 */
export async function hentKontorLogo(sb: SupabaseClient, propertyId: string): Promise<KontorLogo | null> {
  const { data } = await sb.from('properties')
    .select('id, hjem_url, kontor_logo_url, kontor_navn')
    .eq('id', propertyId)
    .maybeSingle()
  const p = data as PropRow | null
  if (!p) return null
  if (p.kontor_logo_url) return { logoUrl: p.kontor_logo_url, navn: p.kontor_navn }
  if (!p.hjem_url) return null

  let listing: Awaited<ReturnType<typeof fetchHjemListing>> = null
  try {
    listing = await fetchHjemListing(p.hjem_url)
  } catch (e) {
    console.error('[kontorlogo] hjem-oppslag feilet:', e)
    return null
  }
  const kildeUrl = listing?.agency?.logoUrl ?? null
  if (!kildeUrl) return null
  const navn = listing?.agency?.name || null

  let logoUrl: string
  try {
    logoUrl = await rastrerTilR2(kildeUrl, listing?.agency?.externalId ?? null)
  } catch (e) {
    console.error('[kontorlogo] rastrering/opplasting feilet:', e)
    return null
  }
  await sb.from('properties').update({ kontor_logo_url: logoUrl, kontor_navn: navn }).eq('id', propertyId)
  return { logoUrl, navn }
}

/** Laster ned logoen, rastrerer til PNG (bredde 1200, gjennomsiktig bakgrunn) og legger den på R2. */
async function rastrerTilR2(kildeUrl: string, agencyId: number | null): Promise<string> {
  const res = await fetch(kildeUrl, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`logo-nedlasting feilet: HTTP ${res.status}`)
  const kilde = Buffer.from(await res.arrayBuffer())

  // sharp lastes lat (ikke på modulnivå): et binærfil bygget for feil plattform
  // skal ikke kunne rive med seg /api/video/generate (lærdom 17/8).
  const sharp = (await import('sharp')).default
  const png = await sharp(kilde, { density: 300 })
    .resize({ width: 1200, withoutEnlargement: false })
    .png()
    .toBuffer()

  const hash = createHash('sha1').update(kilde).digest('hex').slice(0, 10)
  const key = `boligforge/brand/kontor/${agencyId ?? 'ukjent'}-${hash}.png`
  const bucket = process.env.R2_BUCKET_NAME || 'contentforge-assets'
  const r2 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  })
  await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: png, ContentType: 'image/png' }))
  return `${process.env.R2_PUBLIC_URL}/${key}`
}
