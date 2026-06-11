// Avatar-kunnskapsbase: prosessering (Fase 1, Spor A1-lett).
// PDF (fra avatar-docs-bucketen) → tekstekstraksjon (unpdf, serverless-vennlig)
// → chunking (400 ord, 60 overlapp) → batch-embeddings → reelhome_avatar_chunks.
// Typiske prospekter prosesseres på sekunder; svært store dokumenter kan kreve
// flytting til droplet-tjeneste (plan A1) hvis Netlify-timeouts blir et problem.

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUser } from '../../../../../lib/supabase/server'
import { serviceClient, chunkText, embedTexts } from '../../../../../lib/avatar/rag'

export const runtime = 'nodejs'
export const maxDuration = 120

const BUCKET = 'avatar-docs'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { documentId } = await request.json()
  if (!documentId) return NextResponse.json({ error: 'Mangler documentId' }, { status: 400 })

  const client = serviceClient()
  const { data: doc } = await client
    .from('reelhome_avatar_documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle()
  if (!doc || doc.user_id !== user.id) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 })

  await client.from('reelhome_avatar_documents').update({ status: 'processing', error: null }).eq('id', doc.id)

  try {
    // 1. Hent PDF-en fra storage
    const { data: file, error: dlErr } = await client.storage.from(BUCKET).download(doc.storage_path)
    if (dlErr || !file) throw new Error(`Nedlasting feilet: ${dlErr?.message ?? 'tom fil'}`)

    // 2. Tekstekstraksjon
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
    const { totalPages, text } = await extractText(pdf, { mergePages: true })
    const fullText = (Array.isArray(text) ? text.join('\n') : text).trim()
    if (fullText.length < 50) throw new Error('PDF-en inneholder nesten ingen tekst (skannet dokument? OCR støttes ikke ennå)')

    // 3. Chunk + embed (batch)
    const chunks = chunkText(fullText)
    const embeddings = await embedTexts(chunks)

    // 4. Erstatt eksisterende chunks for dokumentet (idempotent re-prosessering)
    await client.from('reelhome_avatar_chunks').delete().eq('document_id', doc.id)
    const rows = chunks.map((content, i) => ({
      document_id: doc.id,
      property_id: doc.property_id,
      kind: doc.kind,
      chunk_index: i,
      content,
      embedding: JSON.stringify(embeddings[i]),
    }))
    // sett inn i bolker à 100 (PostgREST payload-grense)
    for (let i = 0; i < rows.length; i += 100) {
      const { error: insErr } = await client.from('reelhome_avatar_chunks').insert(rows.slice(i, i + 100))
      if (insErr) throw new Error(`Chunk-insert: ${insErr.message}`)
    }

    await client
      .from('reelhome_avatar_documents')
      .update({ status: 'ready', pages: totalPages, error: null })
      .eq('id', doc.id)

    // «Eiendom fra salgsoppgave»: hvis eiendommen er en stubb, ekstraher
    // boligfakta fra dokumentets første del og fyll eiendomsraden.
    let extractedAddress: string | null = null
    const { data: prop } = await client.from('properties').select('id, address').eq('id', doc.property_id).maybeSingle()
    if (prop?.address?.startsWith('⏳')) {
      try {
        const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
        const head = chunks.slice(0, 5).join('\n\n').slice(0, 16000)
        const resp = await claude.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 500,
          tools: [{
            name: 'registrer_boligfakta',
            description: 'Registrer nøkkelfakta om boligen fra salgsoppgaven.',
            input_schema: {
              type: 'object',
              properties: {
                adresse: { type: 'string', description: 'Full adresse inkl. postnummer og sted' },
                tittel: { type: 'string', description: 'Salgsoppgavens overskrift/markedsføringstittel' },
                prisantydning: { type: 'integer' },
                totalpris: { type: 'integer' },
                bra: { type: 'integer', description: 'Bruksareal BRA i m²' },
                soverom: { type: 'integer' },
                rom: { type: 'integer' },
                byggeaar: { type: 'integer' },
                boligtype: { type: 'string', description: 'F.eks. enebolig, leilighet, rekkehus' },
              },
              required: ['adresse'],
              additionalProperties: false,
            },
          }],
          tool_choice: { type: 'tool', name: 'registrer_boligfakta' },
          messages: [{ role: 'user', content: `Hent boligfakta fra denne salgsoppgaven:\n\n${head}` }],
        })
        const tu = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        if (tu) {
          const f = tu.input as { adresse: string; tittel?: string; prisantydning?: number; totalpris?: number; bra?: number; soverom?: number; rom?: number; byggeaar?: number; boligtype?: string }
          extractedAddress = f.adresse
          await client.from('properties').update({
            address: f.adresse,
            title: f.tittel ?? null,
            price: f.prisantydning ?? null,
            price_total: f.totalpris ?? null,
            size_bra: f.bra ?? null,
            bedrooms: f.soverom ?? null,
            rooms: f.rom ?? null,
            build_year: f.byggeaar ?? null,
            property_type: f.boligtype ?? null,
          }).eq('id', prop.id)
        }
      } catch (e) {
        console.error('[avatar/process] fakta-ekstraksjon feilet (eiendommen beholder stubb-navn):', e)
      }
    }

    return NextResponse.json({ success: true, pages: totalPages, chunks: chunks.length, extractedAddress })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await client.from('reelhome_avatar_documents').update({ status: 'failed', error: msg }).eq('id', doc.id)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
