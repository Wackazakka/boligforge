// MIDLERTIDIG verifiserings-probe for LiveAvatar custom-LLM (FULL-modus).
// LiveAvatar kaller dette som vårt «OpenAI-kompatible LLM-endepunkt». Vi logger
// HVA de faktisk sender — særlig: kommer context + dynamic_variables (property_id)
// fram til endepunktet? Svaret avgjør FULL+custom-LLM vs LITE.
//
// Rapporterer funnet til Telegram (lett å lese), og returnerer et gyldig
// OpenAI chat-completion-svar (stream eller ikke) så LiveAvatar ikke feiler.
// SLETTES etter testen.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

async function tg(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chat = process.env.TELEGRAM_CHAT_ID
  if (!token || !chat) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3800) }),
    })
  } catch {}
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch {}

  const messages = Array.isArray(body.messages) ? body.messages as Array<{ role: string; content: unknown }> : []
  const system = messages.find(m => m.role === 'system')
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const blob = JSON.stringify(body)

  // Det vi vil vite: kom property_id / adressen fram? Hvor (system, eget felt)?
  const report = [
    '🔎 LiveAvatar LLM-probe traff oss',
    `topp-nøkler: ${Object.keys(body).join(', ')}`,
    `model: ${String(body.model ?? '—')}  stream: ${String(body.stream ?? '—')}`,
    `inneholder "property_id": ${blob.includes('property_id')}`,
    `inneholder "Bjørndalsveien": ${blob.includes('Bjørndalsveien')}`,
    `inneholder "0a48ea13": ${blob.includes('0a48ea13')}`,
    `--- system-melding (${system ? 'finnes' : 'MANGLER'}) ---`,
    String(system?.content ?? '').slice(0, 1200),
    `--- siste user-melding ---`,
    String(lastUser?.content ?? '').slice(0, 300),
  ].join('\n')
  await tg(report)

  const reply = 'Probe mottok forespørselen. Sjekk Telegram for hva som kom fram.'

  // Returner gyldig OpenAI-svar i riktig form (stream vs ikke).
  if (body.stream === true) {
    const enc = new TextEncoder()
    const id = 'chatcmpl-probe'
    const stream = new ReadableStream({
      start(controller) {
        const chunk = (delta: object, finish: string | null = null) =>
          `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', model: body.model ?? 'probe', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
        controller.enqueue(enc.encode(chunk({ role: 'assistant', content: reply })))
        controller.enqueue(enc.encode(chunk({}, 'stop')))
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  }

  return NextResponse.json({
    id: 'chatcmpl-probe',
    object: 'chat.completion',
    model: body.model ?? 'probe',
    choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  })
}
