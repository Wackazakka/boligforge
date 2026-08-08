import { NextResponse } from 'next/server'
import { createMessage } from '../../../../lib/anthropic'
import { MODELS } from '../../../../lib/models'

const CATEGORIES = ['stue', 'kjøkken', 'bad', 'soverom', 'fasade', 'terrasse', 'hage', 'gang', 'kontor', 'annet']

// Claude ser 20 bilder per kall (~31k tokens). Annonser har ofte 30–50 bilder,
// og bilder UTENFOR klassifiseringen blir usynlige for segment-matchingen —
// derfor kjøres flere partier i parallell, med tak på 60 (~0,3 USD) mot
// runaway-kostnad på ekstreme annonser.
const BATCH_SIZE = 20
const MAX_IMAGES = 60

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'url'; url: string } }

async function classifyBatch(batch: string[]): Promise<Record<string, string[]>> {
  const content: Block[] = []
  batch.forEach((url, i) => {
    content.push({ type: 'text', text: `Bilde ${i + 1}:` })
    content.push({ type: 'image', source: { type: 'url', url } })
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

export async function POST(req: Request) {
  try {
    const { images } = await req.json() as { images: string[] }
    if (!images?.length) return NextResponse.json({ imageTags: {} })

    const capped = images.slice(0, MAX_IMAGES)
    const batches: string[][] = []
    for (let i = 0; i < capped.length; i += BATCH_SIZE) {
      batches.push(capped.slice(i, i + BATCH_SIZE))
    }

    // Ett feilende parti skal ikke velte hele klassifiseringen — de andre
    // partienes tagger er fortsatt nyttige for matchingen.
    const results = await Promise.allSettled(batches.map(classifyBatch))
    const imageTags: Record<string, string[]> = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') Object.assign(imageTags, r.value)
      else console.error(`[classify-images] parti ${i} feilet:`, r.reason)
    })

    return NextResponse.json({ imageTags })
  } catch (err: unknown) {
    console.error('[classify-images]', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
