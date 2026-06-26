// Sentral Claude-klient + robust kall-hjelper for hele appen.
//
// To problemer dette løser (begge erfart i prod/dev):
//  1. ANTHROPIC_BASE_URL-kapring: en arvet miljøvariabel (f.eks. lokal Ollama på
//     :11434 fra Claude Code) får @anthropic-ai/sdk til å sende ALLE kall dit →
//     «404 model not found». Vi setter baseURL EKSPLISITT til det offisielle API-et.
//  2. Stille modell-pensjonering: en pensjonert modell-ID gir 404 og kan knekke en
//     funksjon i dagevis uten at noen merker det (jf. BilDeal: 10 dager stille).
//     createMessage faller tilbake til neste modell i kjeden OG varsler på Telegram.

import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from './models'

// Standard fallback-kjede per modell (kan overstyres per kall med opts.fallback).
const DEFAULT_FALLBACK: Record<string, string[]> = {
  [MODELS.haiku]: [MODELS.sonnet],
  [MODELS.sonnet]: [MODELS.haiku],
}

function client() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    baseURL: 'https://api.anthropic.com',
  })
}

// Telegram-varsel ved modellfeil. Skal ALDRI velte selve Claude-kallet.
async function alert(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chat = process.env.TELEGRAM_CHAT_ID
  if (!token || !chat) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text }),
    })
  } catch {
    /* svelg — varsling er best-effort */
  }
}

// Kall Claude med modell-fallback. params.model er primærmodellen; opts.fallback er
// en ordnet liste med reservemodeller. Ved 404 (modell utilgjengelig/pensjonert)
// prøves neste i kjeden. Andre feil (rate limit, 5xx, ugyldig input) kastes som vanlig.
export async function createMessage(
  params: Anthropic.MessageCreateParamsNonStreaming,
  opts: { fallback?: string[] } = {},
): Promise<Anthropic.Message> {
  const fallback = opts.fallback ?? DEFAULT_FALLBACK[params.model] ?? []
  const chain = [params.model, ...fallback]
    .filter((m, i, a) => !!m && a.indexOf(m) === i) as string[]
  const c = client()
  let lastErr: unknown
  for (let i = 0; i < chain.length; i++) {
    try {
      return await c.messages.create({ ...params, model: chain[i] })
    } catch (e) {
      lastErr = e
      const notFound = e instanceof Anthropic.APIError && e.status === 404
      if (!notFound) throw e
      if (i < chain.length - 1) {
        await alert(`⚠️ ReelHome: Claude-modell «${chain[i]}» utilgjengelig (404). Faller tilbake til «${chain[i + 1]}».`)
        continue
      }
      await alert(`🚨 ReelHome: ingen Claude-modell svarte (prøvde: ${chain.join(', ')}). Sjekk modell-ID-er i lib/models.ts.`)
      throw e
    }
  }
  throw lastErr
}
