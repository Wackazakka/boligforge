// Kunnskapsbase-verktøy for ReelHome Avatar (Fase 1, Spor B1).
// Chunking/embedding/retrieval-mønstrene er portet fra Dr. Hanni
// (import-knowledge.js / search-knowledge.js) — se docs/avatar-fase0-funn.md.

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 1536 dimensjoner — må matche vector(1536) i reelhome_avatar_chunks
const OPENAI_EMBED_MODEL = 'text-embedding-3-small'

export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Chunking (ord-basert m/ overlapp så setninger ikke kappes mellom chunks) ──
export function chunkText(text: string, maxWords = 400, overlapWords = 60): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const chunks: string[] = []
  let start = 0
  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length)
    chunks.push(words.slice(start, end).join(' '))
    if (end >= words.length) break
    start = end - overlapWords
  }
  return chunks
}

// ── Embeddings (batch — alle tekster i ett kall) ──────────────────────────────
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: OPENAI_EMBED_MODEL, input: texts }),
  })
  if (!res.ok) {
    throw new Error(`OpenAI embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const data = await res.json()
  return data.data.map((d: { embedding: number[] }) => d.embedding)
}

// ── Retrieval (match_avatar_chunks fra migrasjonen) ───────────────────────────
export type RetrievedChunk = { id: string; content: string; kind: string; page: number | null; similarity: number }

export async function retrieveChunks(
  client: SupabaseClient,
  propertyId: string,
  question: string,
  matchCount = 6
): Promise<RetrievedChunk[]> {
  const [embedding] = await embedTexts([question])
  const { data, error } = await client.rpc('match_avatar_chunks', {
    p_property_id: propertyId,
    query_embedding: JSON.stringify(embedding),
    match_count: matchCount,
  })
  if (error) throw new Error(`match_avatar_chunks: ${error.message}`)
  return data ?? []
}

// ── Fakta-blokk fra properties-tabellen (strukturert grunnsannhet) ────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPropertyFacts(p: any): string {
  const fmt = (n: number | null | undefined) => (n != null ? n.toLocaleString('nb-NO') : null)
  const facts = [
    p.title && `Tittel: ${p.title}`,
    p.address && `Adresse: ${p.address}`,
    p.price && `Prisantydning: ${fmt(p.price)} kr`,
    p.price_total && `Totalpris: ${fmt(p.price_total)} kr`,
    p.shared_costs && `Felleskostnader: ${fmt(p.shared_costs)} kr/mnd`,
    p.shared_debt && `Fellesgjeld: ${fmt(p.shared_debt)} kr`,
    p.size_bra && `Bruksareal (BRA): ${p.size_bra} m²`,
    p.rooms && `Rom: ${p.rooms}`,
    p.bedrooms && `Soverom: ${p.bedrooms}`,
    p.build_year && `Byggeår: ${p.build_year}`,
    p.property_type && `Boligtype: ${p.property_type}`,
    p.ownership_type && `Eierform: ${p.ownership_type}`,
    p.energy_label && `Energimerke: ${p.energy_label}`,
    p.floor && `Etasje: ${p.floor}`,
    p.viewing_dates && `Visningsdatoer: ${p.viewing_dates}`,
  ].filter(Boolean)
  return facts.join('\n')
}

// ── Systemprompt m/ guardrails ────────────────────────────────────────────────
export function buildAvatarSystemPrompt(opts: {
  agentName: string
  facts: string
  chunks: RetrievedChunk[]
}): string {
  const kilder = opts.chunks.length
    ? opts.chunks.map((c, i) => `[Kilde ${i + 1}${c.page ? `, ${c.kind} s.${c.page}` : `, ${c.kind}`}]\n${c.content}`).join('\n\n')
    : '(Ingen dokumentutdrag funnet for dette spørsmålet.)'

  return `Du er ${opts.agentName}, en vennlig norsk eiendomsmegler-assistent som svarer muntlig på spørsmål om ÉN bestemt bolig under en digital visning. Svarene dine leses opp av en video-avatar, så svar kort og naturlig muntlig (2–4 setninger), uten punktlister, markdown eller tegn som ikke kan uttales.

BOLIGFAKTA (strukturert grunnsannhet — stol alltid på denne):
${opts.facts}

DOKUMENTUTDRAG (fra prospekt/tilstandsrapport — bruk til detaljspørsmål):
${kilder}

REGLER:
1. Svar KUN basert på boligfakta og dokumentutdragene over. Hvis svaret ikke finnes der, si ærlig: «Det har jeg ikke informasjon om her — det kan megleren svare på» og tilby å notere spørsmålet.
2. Aldri gjett på priser, mål, tilstand eller juridiske forhold.
3. Ved spørsmål om tilstandsrapportens TG-verdier: referer nøyaktig det som står.
4. Hvis interessenten vil på visning, bli kontaktet eller legge igjen kontaktinfo: bruk verktøyet registrer_interessent.
5. Svar alltid på norsk, uansett hvilket språk spørsmålet kommer på (med mindre interessenten eksplisitt ber om engelsk).`
}
