// E2E-test av avatar-kunnskapsbase-pipelinen mot ekte DB (rydder opp etter seg).
import { readFileSync } from 'fs'

// last .env.local manuelt
for (const line of readFileSync('/Users/larskilevold_1/boligforge/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { serviceClient, chunkText, embedTexts, retrieveChunks } = await import('../lib/avatar/rag')

const PROPERTY = '9eafa4b5-590c-4d48-8411-8c19e40605cf' // Martin Lillebys vei 4B
const PDF = '/Users/larskilevold_1/Downloads/100154535.pdf'

const client = serviceClient()

// 1) PDF-ekstraksjon (unpdf)
const { extractText, getDocumentProxy } = await import('unpdf')
const pdf = await getDocumentProxy(new Uint8Array(readFileSync(PDF)))
const { totalPages, text } = await extractText(pdf, { mergePages: true })
const fullText = (Array.isArray(text) ? text.join('\n') : text).trim()
console.log(`1) unpdf: ${totalPages} sider, ${fullText.length} tegn. Start: "${fullText.slice(0, 100).replace(/\s+/g, ' ')}..."`)

// 2) chunking
const chunks = chunkText(fullText)
console.log(`2) chunking: ${chunks.length} chunks (à ~400 ord)`)

// 3) embeddings (batch)
const t0 = Date.now()
const embeddings = await embedTexts(chunks)
console.log(`3) embeddings: ${embeddings.length} stk à ${embeddings[0].length} dim på ${Date.now() - t0} ms`)

// 4) insert (testdokument)
const { data: doc, error: docErr } = await client
  .from('reelhome_avatar_documents')
  .insert({ property_id: PROPERTY, user_id: '831847a0-daf3-4765-a3ea-632a065c5b92', kind: 'prospekt', filename: 'PIPELINE-TEST.pdf', storage_path: 'test/none' })
  .select().single()
if (docErr) throw new Error(docErr.message)
const rows = chunks.map((content, i) => ({
  document_id: doc.id, property_id: PROPERTY, kind: 'prospekt', content, embedding: JSON.stringify(embeddings[i]),
}))
for (let i = 0; i < rows.length; i += 100) {
  const { error } = await client.from('reelhome_avatar_chunks').insert(rows.slice(i, i + 100))
  if (error) throw new Error(error.message)
}
console.log(`4) insert: ${rows.length} chunks lagret`)

// 5) retrieval — still spørsmål mot innholdet
for (const q of ['Hva er prisantydningen på boligen?', 'Hvordan er tilstanden på badet?']) {
  const t1 = Date.now()
  const hits = await retrieveChunks(client, PROPERTY, q, 3)
  console.log(`5) "${q}" → ${hits.length} treff på ${Date.now() - t1} ms; topp-similarity ${hits[0]?.similarity?.toFixed(3)}`)
  console.log(`   topptreff: "${hits[0]?.content.slice(0, 140).replace(/\s+/g, ' ')}..."`)
}

// 6) opprydding
await client.from('reelhome_avatar_documents').delete().eq('id', doc.id)
const { count } = await client.from('reelhome_avatar_chunks').select('id', { count: 'exact', head: true }).eq('document_id', doc.id)
console.log(`6) opprydding: dokument slettet, gjenværende chunks: ${count} (skal være 0 via cascade)`)
console.log('✅ PIPELINE OK')
