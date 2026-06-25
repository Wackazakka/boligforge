import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '../../../../lib/models'

const getClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const CATEGORIES = ['stue', 'kjøkken', 'bad', 'soverom', 'fasade', 'terrasse', 'hage', 'gang', 'kontor', 'annet']

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { images } = await req.json() as { images: string[] }
    if (!images?.length) return NextResponse.json({ imageTags: {} })

    // Cap at 20 images per API call
    const batch = images.slice(0, 20)

    type Block =
      | { type: 'text'; text: string }
      | { type: 'image'; source: { type: 'url'; url: string } }

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

    const msg = await getClient().messages.create({
      model: MODELS.sonnet,
      max_tokens: 512,
      messages: [{ role: 'user', content }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed: Record<string, string[]> = JSON.parse(jsonStr)

    // Map index → original URL
    const imageTags: Record<string, string[]> = {}
    batch.forEach((url, i) => {
      imageTags[url] = parsed[String(i + 1)] ?? ['annet']
    })

    return NextResponse.json({ imageTags })
  } catch (err: unknown) {
    console.error('[classify-images]', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
