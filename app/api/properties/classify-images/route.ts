import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createMessage } from '../../../../lib/anthropic'
import { MODELS } from '../../../../lib/models'

const CATEGORIES = ['stue', 'kjøkken', 'bad', 'soverom', 'fasade', 'terrasse', 'hage', 'gang', 'kontor', 'annet']

// Kostnadsmodell (målt 8. aug 2026): Claude tokeniserer bilder etter areal.
// Et prod-bilde på 1417x945 koster ~1 560 tokens; 768 px lengste side koster
// ~625. Verifisert på ekte annonse: 768 px gir IDENTISK klassifisering på
// 20/20 bilder (512 px mistet én sekundærtagg) — derfor 768, ikke lavere.
// Klienten nedskalerer og sender miniatyrer; ruten cacher resultatet per bolig
// slik at gjentatte «Del opp i segmenter» er gratis.
const BATCH_SIZE = 20

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// media_type må være en av SDK-ens literaler — derfor hviteliste, ikke string.
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type MediaType = typeof MEDIA_TYPES[number]

type ImageSource =
  | { type: 'url'; url: string }
  | { type: 'base64'; media_type: MediaType; data: string }

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ImageSource }

function toBlock(url: string, thumb?: string): ImageSource {
  // Miniatyr fra klienten kommer som data-URL; ellers lar vi Claude hente URL-en.
  const m = thumb?.match(/^data:(image\/[a-z+]+);base64,(.+)$/)
  const mt = MEDIA_TYPES.find(t => t === m?.[1])
  if (m && mt) return { type: 'base64', media_type: mt, data: m[2] }
  return { type: 'url', url }
}

async function classifyBatch(batch: string[], thumbs: Record<string, string>): Promise<Record<string, string[]>> {
  const content: Block[] = []
  batch.forEach((url, i) => {
    content.push({ type: 'text', text: `Bilde ${i + 1}:` })
    content.push({ type: 'image', source: toBlock(url, thumbs[url]) })
  })
  content.push({
    type: 'text',
    text: `Klassifiser hvert av de ${batch.length} bildene ovenfor med én eller flere kategorier fra denne listen: ${CATEGORIES.join(', ')}.

Svar kun med JSON (ingen markdown, ingen forklaring, ingen annen tekst):
{"1":["kategori"],"2":["kategori","kategori"],...}

Bruk bildets nummer (1, 2, 3 osv.) som nøkkel. Bruk "annet" for bilder som ikke passer noen annen kategori.`,
  })

  const msg = await createMessage({
    model: MODELS.sonnet,
    max_tokens: 512,
    messages: [{ role: 'user', content }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()
  const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const parsed: Record<string, string[]> = JSON.parse(jsonStr)

  const out: Record<string, string[]> = {}
  batch.forEach((url, i) => {
    out[url] = parsed[String(i + 1)] ?? ['annet']
  })
  return out
}

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(req: Request) {
  try {
    const { images, propertyId, classify, thumbs } = await req.json() as {
      images: string[]
      propertyId?: string
      classify?: string[]                 // hvilke bilder klienten vil ha klassifisert nå
      thumbs?: Record<string, string>     // nedskalerte data-URL-er for dem som lot seg skalere
    }
    if (!images?.length) return NextResponse.json({ imageTags: {} })

    // 1) Hent cache. Bildevalget avhenger av disse taggene, så de lagres per
    // bolig og gjenbrukes — re-segmentering etter manusendring er vanlig, og
    // kostet tidligere full klassifisering hver gang.
    let cached: Record<string, string[]> = {}
    if (propertyId) {
      const { data } = await svc().from('properties').select('image_tags').eq('id', propertyId).maybeSingle()
      const row = data as { image_tags?: Record<string, string[]> | null } | null
      if (row?.image_tags) cached = row.image_tags
    }

    const missing = images.filter(u => !cached[u])
    if (missing.length === 0) {
      return NextResponse.json({ imageTags: cached, cacheHit: true })
    }

    // 2) Ingen `classify`-liste: fortell hvilke som mangler, så klienten kan
    // skalere dem ned før de sendes (fullstørrelse koster ~2,5x mer i tokens).
    // Klienten styrer porsjoneringen — da kan løkken aldri henge.
    if (!classify?.length) {
      return NextResponse.json({ imageTags: cached, needThumbs: missing })
    }

    // 3) Klassifiser den porsjonen klienten ba om. Bilder uten miniatyr
    // (nedskalering feilet) faller tilbake til URL — dyrere, men virker.
    const provided = thumbs ?? {}
    const todo = classify.filter(u => !cached[u])
    if (todo.length === 0) return NextResponse.json({ imageTags: cached })

    const batches: string[][] = []
    for (let i = 0; i < todo.length; i += BATCH_SIZE) {
      batches.push(todo.slice(i, i + BATCH_SIZE))
    }
    const results = await Promise.allSettled(batches.map(b => classifyBatch(b, provided)))
    const fresh: Record<string, string[]> = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') Object.assign(fresh, r.value)
      else console.error(`[classify-images] parti ${i} feilet:`, r.reason)
    })

    const merged = { ...cached, ...fresh }
    if (propertyId && Object.keys(fresh).length > 0) {
      const { error } = await svc().from('properties').update({ image_tags: merged }).eq('id', propertyId)
      if (error) console.error('[classify-images] kunne ikke lagre cache:', error)
    }

    const stillMissing = images.filter(u => !merged[u])
    return NextResponse.json({ imageTags: merged, ...(stillMissing.length ? { needThumbs: stillMissing } : {}) })
  } catch (err: unknown) {
    console.error('[classify-images]', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
