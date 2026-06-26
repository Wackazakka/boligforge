// OpenAI-kompatibelt LLM-endepunkt for LiveAvatar (FULL-modus, custom LLM).
// LiveAvatar gjør STT/TTS/render og kaller DETTE for «hjernen»: STT-transkript →
// hit → vår RAG + Claude + speakify → tilbake → LiveAvatars TTS leser svaret.
//
// Gjenbruker avatar/ask-logikken, men:
//  - auth: delt Bearer-secret (LiveAvatar sender llm-config-secreten), ikke getUser
//  - input/output: OpenAI /chat/completions (messages inn, chat.completion ut)
//  - property_id hentes fra system-meldingen (LiveAvatar fyller den fra dynamic_variables)

import Anthropic from '@anthropic-ai/sdk'
import { createMessage } from '../../../../../../lib/anthropic'
import {
  serviceClient, retrieveChunks, keywordChunks, neighborChunks,
  buildPropertyFacts, buildAvatarSystemPrompt,
} from '../../../../../../lib/avatar/rag'
import { isCostQuestion, buildCostBaseSection } from '../../../../../../lib/avatar/costbase'
import { speakifyForTTS } from '../../../../../../lib/norwegian-numbers'

export const runtime = 'nodejs'
export const maxDuration = 30

const MODEL = process.env.AVATAR_CLAUDE_MODEL || 'claude-sonnet-4-6'

const LEAD_TOOL: Anthropic.Tool = {
  name: 'registrer_interessent',
  description:
    'Registrer en interessent for denne boligen. Kall dette verktøyet når personen sier de vil på visning, vil bli kontaktet av megler, eller oppgir kontaktinformasjon. Spør om navn (påkrevd) og telefon eller e-post før du kaller verktøyet.',
  input_schema: {
    type: 'object',
    properties: {
      navn: { type: 'string', description: 'Interessentens fulle navn' },
      telefon: { type: 'string', description: 'Telefonnummer' },
      epost: { type: 'string', description: 'E-postadresse' },
      melding: { type: 'string', description: 'Eventuell beskjed til megleren' },
    },
    required: ['navn'],
    additionalProperties: false,
  },
}

type OAMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function unauthorized() {
  return new Response(JSON.stringify({ error: { message: 'Unauthorized', type: 'invalid_request_error' } }), {
    status: 401, headers: { 'Content-Type': 'application/json' },
  })
}

// Bygg det endelige svaret (RAG + Claude + lead-loop + speakify) for én bruker-tur.
async function answer(propertyId: string, question: string, history: OAMessage[]): Promise<string> {
  const client = serviceClient()
  const { data: property } = await client.from('properties').select('*').eq('id', propertyId).maybeSingle()
  if (!property) return 'Beklager, jeg finner ikke informasjon om denne boligen akkurat nå.'

  // Hybrid retrieval (samme som avatar/ask)
  const isEnumeration = /\b(alle|hvilke|oversikt|liste|list opp|samtlige)\b/i.test(question)
  const normalized = question
    .replace(/\b(TG|tilstandsgrad)[\s-]?(null|en|én|ett)\b/gi, 'TG1')
    .replace(/\b(TG|tilstandsgrad)[\s-]?to\b/gi, 'TG2')
    .replace(/\b(TG|tilstandsgrad)[\s-]?tre\b/gi, 'TG3')
    .replace(/\btilstandsgrad[\s-]?([0-3])\b/gi, 'TG$1')
  const tgDigits = [...normalized.matchAll(/\bTG\s?-?([0-3])\b/gi)].map(m => m[1])
  const kwTerms: string[] = []
  for (const n of tgDigits) kwTerms.push(`TG${n}`, `TG ${n}`, `Tilstandsgrad ${n}`)
  if (tgDigits.length > 0 || /\bavvik|tilstand|mangler|feil\b/i.test(question)) {
    kwTerms.push('kan kreve tiltak', 'ikke krever umiddelbare tiltak', 'KOMPLETT AVVIKSOVERSIKT')
  }
  if (/gjennomsnitt|kvadratmeterpris|prisnivå|området|nabolag|sammenlign|markedet/i.test(question)) {
    kwTerms.push('Sammenlignbare salg', 'sammenlignbare')
  }

  let chunks: Awaited<ReturnType<typeof retrieveChunks>> = []
  try {
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
    for (const nb of await neighborChunks(client, allKw)) {
      if (!chunks.some(x => x.id === nb.id)) chunks.push(nb)
    }
    chunks = chunks.slice(0, 44)
  } catch (e) {
    console.error('[liveavatar-llm] retrieval feilet:', e)
  }

  let system = buildAvatarSystemPrompt({
    agentName: property.agent_id ? 'meglerens digitale assistent' : 'den digitale visningsassistenten',
    facts: buildPropertyFacts(property),
    chunks,
  })
  if (isCostQuestion(question)) system += '\n' + buildCostBaseSection()

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content })),
    { role: 'user', content: question },
  ]

  let response = await createMessage({ model: MODEL, max_tokens: 1000, system, tools: [LEAD_TOOL], messages })
  for (let i = 0; i < 2 && response.stop_reason === 'tool_use'; i++) {
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    messages.push({ role: 'assistant', content: response.content })
    const results: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      if (tu.name === 'registrer_interessent') {
        const inp = tu.input as { navn: string; telefon?: string; epost?: string; melding?: string }
        const { error: insErr } = await client.from('reelhome_viewing_signups').insert({
          property_id: propertyId, buyer_name: inp.navn, buyer_phone: inp.telefon ?? null,
          buyer_email: inp.epost ?? null, buyer_message: inp.melding ?? null,
          consent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        results.push({ type: 'tool_result', tool_use_id: tu.id,
          content: insErr ? `Registrering feilet: ${insErr.message}` : 'Interessenten er registrert hos megleren.',
          is_error: !!insErr })
      } else {
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Ukjent verktøy', is_error: true })
      }
    }
    messages.push({ role: 'user', content: results })
    response = await createMessage({ model: MODEL, max_tokens: 1000, system, tools: [LEAD_TOOL], messages })
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join(' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|\s)\*([^*\n]+)\*(?=[\s.,!?]|$)/g, '$1$2')
    .replace(/^#{1,4}\s+/gm, '').replace(/^\s*[-•]\s+/gm, '').trim()

  // Speakify (tall→ord + uttalefiks) — LiveAvatars TTS leser dette ordrett.
  return speakifyForTTS(text || 'Beklager, kan du gjenta spørsmålet?')
}

export async function POST(request: Request) {
  const secret = process.env.LIVEAVATAR_LLM_SECRET
  const auth = request.headers.get('authorization') || ''
  if (!secret || auth !== `Bearer ${secret}`) return unauthorized()

  let body: { messages?: OAMessage[]; model?: string; stream?: boolean } = {}
  try { body = await request.json() } catch {}
  const msgs = Array.isArray(body.messages) ? body.messages : []

  // property_id fra system-meldingen (LiveAvatar fyller ${property_id} fra dynamic_variables)
  const systemText = msgs.filter(m => m.role === 'system').map(m => m.content).join('\n')
  const propertyId = (systemText.match(/property_id\s*[=:]\s*([0-9a-fA-F-]{36})/) || [])[1]
    || (systemText.match(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/) || [])[0]
    || ''

  const convo = msgs.filter(m => m.role !== 'system') as OAMessage[]
  const lastUser = [...convo].reverse().find(m => m.role === 'user')
  const question = lastUser?.content?.trim() || ''
  const history = convo.slice(0, convo.lastIndexOf(lastUser as OAMessage))

  let reply: string
  if (!propertyId) reply = 'Beklager, jeg mangler informasjon om hvilken bolig dette gjelder.'
  else if (!question) reply = 'Hei! Hva lurer du på om denne boligen?'
  else {
    try { reply = await answer(propertyId, question, history) }
    catch (e) { console.error('[liveavatar-llm] feil:', e); reply = 'Beklager, noe gikk galt. Kan du prøve igjen?' }
  }

  const model = body.model || 'reelhome-claude'
  if (body.stream === true) {
    const enc = new TextEncoder()
    const id = 'chatcmpl-' + Math.round(Date.now() / 1000)
    const stream = new ReadableStream({
      start(controller) {
        const chunk = (delta: object, finish: string | null = null) =>
          `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
        controller.enqueue(enc.encode(chunk({ role: 'assistant', content: reply })))
        controller.enqueue(enc.encode(chunk({}, 'stop')))
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } })
  }

  return new Response(JSON.stringify({
    id: 'chatcmpl-' + Math.round(Date.now() / 1000), object: 'chat.completion', model,
    choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  }), { headers: { 'Content-Type': 'application/json' } })
}
