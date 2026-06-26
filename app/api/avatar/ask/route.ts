// Avatar-hjernen (Fase 1, Spor B2): spørsmål → RAG-oppslag → Claude → svar.
// Svaret sendes av klienten til LiveAvatar via repeat() (avataren leser det opp).
//
// Modell: claude-sonnet-4-6 (default) — valgt for svarkvalitet på salgsoppgave/
// tilstandsrapport. Konfigurerbar via AVATAR_CLAUDE_MODEL; bytt til en haiku-
// modell hvis sanntids-latency (totalbudsjett ~2-3 s) blir viktigere enn kvalitet.
//
// Lead-fangst: ekte tool use m/ strikt skjema (registrer_interessent) — ikke
// regex/markør-parsing (se SummonIt-lærdommen i docs/avatar-fase0-funn.md).
//
// MVP-gating: getUser (megler tester). Spor C bytter til visningstoken-gating.

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUser } from '../../../../lib/supabase/server'
import { serviceClient, retrieveChunks, keywordChunks, neighborChunks, buildPropertyFacts, buildAvatarSystemPrompt } from '../../../../lib/avatar/rag'
import { isCostQuestion, buildCostBaseSection } from '../../../../lib/avatar/costbase'
import { speakifyForTTS } from '../../../../lib/norwegian-numbers'

export const runtime = 'nodejs'
export const maxDuration = 30

const MODEL = process.env.AVATAR_CLAUDE_MODEL || 'claude-sonnet-4-6'
// baseURL settes EKSPLISITT: en arvet ANTHROPIC_BASE_URL i miljøet (f.eks. en lokal
// Ollama på :11434 fra Claude Code-oppsettet) ville ellers kapre alle Claude-kall og gi
// «404 model not found». Appen skal alltid snakke med det offisielle API-et.
const getClaude = () => new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  baseURL: 'https://api.anthropic.com',
})

const LEAD_TOOL: Anthropic.Tool = {
  name: 'registrer_interessent',
  description:
    'Registrer en interessent for denne boligen. Kall dette verktøyet når personen i samtalen sier at de vil på visning, vil bli kontaktet av megler, eller oppgir kontaktinformasjon. Spør om navn (påkrevd) og telefon eller e-post før du kaller verktøyet.',
  input_schema: {
    type: 'object',
    properties: {
      navn: { type: 'string', description: 'Interessentens fulle navn' },
      telefon: { type: 'string', description: 'Telefonnummer' },
      epost: { type: 'string', description: 'E-postadresse' },
      melding: { type: 'string', description: 'Eventuell beskjed til megleren, f.eks. hvilket spørsmål de vil ha svar på' },
    },
    required: ['navn'],
    additionalProperties: false,
  },
}

type HistoryItem = { role: 'user' | 'assistant'; content: string }

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { propertyId, question, history } = await request.json()
  if (!propertyId || !question) return NextResponse.json({ error: 'Mangler propertyId/question' }, { status: 400 })

  const client = serviceClient()

  // Boligfakta + relevante dokumentutdrag
  const { data: property } = await client.from('properties').select('*').eq('id', propertyId).maybeSingle()
  if (!property) return NextResponse.json({ error: 'Ukjent eiendom' }, { status: 404 })

  // Hybrid retrieval: semantisk søk + eksakt nøkkelordsøk for opplistings-
  // spørsmål (f.eks. TG2-avvik spredt over hele rapporten — semantikk alene
  // henter bare de «likeste» bitene og mister resten).
  const isEnumeration = /\b(alle|hvilke|oversikt|liste|list opp|samtlige)\b/i.test(question)
  // muntlige varianter fra tale-transkripsjon: «TG to», «tilstandsgrad tre» osv.
  const normalized = question
    .replace(/\b(TG|tilstandsgrad)[\s-]?(null|en|én|ett)\b/gi, 'TG1')
    .replace(/\b(TG|tilstandsgrad)[\s-]?to\b/gi, 'TG2')
    .replace(/\b(TG|tilstandsgrad)[\s-]?tre\b/gi, 'TG3')
    .replace(/\btilstandsgrad[\s-]?([0-3])\b/gi, 'TG$1')
  const tgDigits = [...normalized.matchAll(/\bTG\s?-?([0-3])\b/gi)].map(m => m[1])
  // Rapportene skriver gradene på flere måter (TG2 / TG 2 / Tilstandsgrad 2) og
  // grupperer avvik under kategorifraser UTEN «TG2» i teksten («avvik som ikke
  // krever umiddelbare tiltak» — funnet ved testing 2026-06-11). Søk alle varianter.
  const kwTerms: string[] = []
  for (const n of tgDigits) kwTerms.push(`TG${n}`, `TG ${n}`, `Tilstandsgrad ${n}`)
  if (tgDigits.length > 0 || /\bavvik|tilstand|mangler|feil\b/i.test(question)) {
    kwTerms.push('kan kreve tiltak', 'ikke krever umiddelbare tiltak', 'KOMPLETT AVVIKSOVERSIKT')
  }
  // områdepris-spørsmål: rapportene har ofte en 'Sammenlignbare salg'-tabell
  if (/gjennomsnitt|kvadratmeterpris|prisnivå|området|nabolag|sammenlign|markedet/i.test(question)) {
    kwTerms.push('Sammenlignbare salg', 'sammenlignbare')
  }

  let chunks: Awaited<ReturnType<typeof retrieveChunks>> = []
  try {
    // Vektorsøk + alle nøkkelordsøk i parallell (var sekvensielt → N DB-rundturer på rad).
    const [vector, ...kwResults] = await Promise.all([
      retrieveChunks(client, propertyId, question, isEnumeration || kwTerms.length ? 10 : 6),
      ...kwTerms.map(term => keywordChunks(client, propertyId, term, 40)),
    ])
    chunks = [...vector]
    const allKw: Awaited<ReturnType<typeof keywordChunks>> = []
    for (const kw of kwResults) {
      for (const c of kw) {
        if (!chunks.some(x => x.id === c.id)) chunks.push(c)
        allKw.push(c)
      }
    }
    // naboer til nøkkelordtreff (lister fortsetter over chunk-grenser)
    for (const n of await neighborChunks(client, allKw)) {
      if (!chunks.some(x => x.id === n.id)) chunks.push(n)
    }
    chunks = chunks.slice(0, 44)
  } catch (e) {
    console.error('[avatar/ask] retrieval feilet (fortsetter med kun fakta):', e)
  }

  let system = buildAvatarSystemPrompt({
    agentName: property.agent_id ? 'meglerens digitale assistent' : 'den digitale visningsassistenten',
    facts: buildPropertyFacts(property),
    chunks,
  })
  // Kuratert kostnadsbase (nivå 2) — kun ved kostnadsspørsmål, alltid m/ forbehold
  if (isCostQuestion(question)) system += '\n' + buildCostBaseSection()

  const messages: Anthropic.MessageParam[] = [
    ...(Array.isArray(history) ? (history as HistoryItem[]).slice(-12) : []),
    { role: 'user', content: question },
  ]

  const claude = getClaude()
  let leadCaptured = false

  try {
    let response = await claude.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system,
      tools: [LEAD_TOOL],
      messages,
    })

    // Verktøy-loop (maks 2 runder — lead-registrering er eneste verktøy)
    for (let i = 0; i < 2 && response.stop_reason === 'tool_use'; i++) {
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )
      messages.push({ role: 'assistant', content: response.content })

      const results: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        if (tu.name === 'registrer_interessent') {
          const inp = tu.input as { navn: string; telefon?: string; epost?: string; melding?: string }
          const { error: insErr } = await client.from('reelhome_viewing_signups').insert({
            property_id: propertyId,
            buyer_name: inp.navn,
            buyer_phone: inp.telefon ?? null,
            buyer_email: inp.epost ?? null,
            buyer_message: inp.melding ?? null,
            consent_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          if (insErr) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: `Registrering feilet: ${insErr.message}`, is_error: true })
          } else {
            leadCaptured = true
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Interessenten er registrert hos megleren.' })
          }
        } else {
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Ukjent verktøy', is_error: true })
        }
      }
      messages.push({ role: 'user', content: results })

      response = await claude.messages.create({ model: MODEL, max_tokens: 1000, system, tools: [LEAD_TOOL], messages })
    }

    // Taletekst-vask: modellen sniker inn markdown tross instruks — strippes
    // maskinelt (avataren leser teksten ordrett høyt).
    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join(' ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|\s)\*([^*\n]+)\*(?=[\s.,!?]|$)/g, '$1$2')
      .replace(/^#{1,4}\s+/gm, '')
      .replace(/^\s*[-•]\s+/gm, '')
      .trim()

    const finalAnswer = answer || 'Beklager, kan du gjenta spørsmålet?'
    return NextResponse.json({
      answer: finalAnswer,
      speech: speakifyForTTS(finalAnswer),
      leadCaptured,
      sources: chunks.map(c => ({ id: c.id, kind: c.kind, page: c.page, similarity: Math.round(c.similarity * 100) / 100 })),
      model: MODEL,
    })
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error(`[avatar/ask] Claude ${e.status}:`, e.message)
      return NextResponse.json({ error: `Claude-feil (${e.status})` }, { status: 502 })
    }
    throw e
  }
}
