import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
// NB: navngitt import med vilje — Turbopack løser ESM-bygget (opentype.mjs) som
// KUN har navngitte eksporter. (Node-CLI løser CJS-bygget, som er motsatt.)
import { parse as parseFont } from 'opentype.js'
import { getUser } from '../../../../lib/supabase/server'
import { TITLE_FONT_B64 } from './font'

// Tittelkort for videoens åpningsbilde: annonse-overskriften komponeres INN i
// bildet her i webappen (hvit tekst, svart outline, svak scrim). Worker-en på
// dropleten mottar et helt vanlig stillbilde — render-pipelinen røres ikke.
//
// Teksten tegnes som SVG-KURVER (opentype.js + innbakt Open Sans Bold), ikke
// <text>-elementer: produksjonsserverne har ingen systemfonter, så vanlig
// SVG-tekst rendret som tomme bokser (verifisert på artefaktnivå 5/8).

export const runtime = 'nodejs'

const W = 1920
const H = 1080

let cachedFont: ReturnType<typeof parseFont> | null = null
function getFont() {
  if (!cachedFont) {
    const buf = Buffer.from(TITLE_FONT_B64, 'base64')
    cachedFont = parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  }
  return cachedFont
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

// Enkel ordbasert linjebryting
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars && line) { lines.push(line); line = w }
    else line = (line + ' ' + w).trim()
  }
  if (line) lines.push(line)
  return lines
}

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { imageUrl, title } = await request.json()
    if (!imageUrl || !title?.trim()) {
      return Response.json({ error: 'Mangler imageUrl eller title' }, { status: 400 })
    }
    // Kun bilder fra vår egen R2 — endepunktet skal ikke kunne hente vilkårlige URL-er
    const publicBase = process.env.R2_PUBLIC_URL || 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev'
    if (!String(imageUrl).startsWith(publicBase)) {
      return Response.json({ error: 'Ugyldig bildekilde' }, { status: 400 })
    }

    const text = String(title).trim().slice(0, 220)

    // Font-størrelse etter lengde: lange titler får mindre skrift
    let fontSize = 72, maxChars = 34
    if (text.length > 90) { fontSize = 58; maxChars = 42 }
    if (text.length > 150) { fontSize = 48; maxChars = 52 }
    const lines = wrap(text, maxChars)
    const lineHeight = fontSize * 1.25
    const blockH = lines.length * lineHeight
    const startY = H / 2 - blockH / 2 + fontSize
    const strokeW = Math.max(4, fontSize / 11)

    const font = getFont()
    const paths = lines.map((l, i) => {
      const width = font.getAdvanceWidth(l, fontSize)
      const x = (W - width) / 2
      const y = startY + i * lineHeight
      const d = font.getPath(l, x, y, fontSize).toPathData(2)
      return `<path d="${d}" fill="#ffffff" stroke="#000000" stroke-width="${strokeW}"
        paint-order="stroke" stroke-linejoin="round"/>`
    }).join('\n')

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${H / 2 - blockH / 2 - 40}" width="${W}" height="${blockH + 80}" fill="rgba(0,0,0,0.28)"/>
      ${paths}
    </svg>`

    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) return Response.json({ error: 'Kunne ikke hente bildet' }, { status: 502 })
    const img = Buffer.from(await imgRes.arrayBuffer())

    const out = await sharp(img)
      .resize(W, H, { fit: 'cover' })
      .composite([{ input: Buffer.from(svg) }])
      .jpeg({ quality: 88 })
      .toBuffer()

    const bucket = process.env.R2_BUCKET_NAME || 'contentforge-assets'
    const key = `boligforge/intro-cards/${user.id}_${Date.now()}.jpg`
    await getR2().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: out, ContentType: 'image/jpeg' })
    )

    return Response.json({ url: `${publicBase}/${key}` })
  } catch (err: unknown) {
    console.error('[video/intro-card]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
