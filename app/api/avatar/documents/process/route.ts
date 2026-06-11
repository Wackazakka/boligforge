// Avatar-kunnskapsbase: prosessering (Fase 1, Spor A1-lett).
// PDF (fra avatar-docs-bucketen) → tekstekstraksjon (unpdf, serverless-vennlig)
// → chunking (400 ord, 60 overlapp) → batch-embeddings → reelhome_avatar_chunks.
// Typiske prospekter prosesseres på sekunder; svært store dokumenter kan kreve
// flytting til droplet-tjeneste (plan A1) hvis Netlify-timeouts blir et problem.

import { NextResponse } from 'next/server'
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

    return NextResponse.json({ success: true, pages: totalPages, chunks: chunks.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await client.from('reelhome_avatar_documents').update({ status: 'failed', error: msg }).eq('id', doc.id)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
