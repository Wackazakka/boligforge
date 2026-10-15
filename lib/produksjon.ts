import type { SupabaseClient } from '@supabase/supabase-js'
import { PRIS, maanedStart } from './boliger'

// «Bestill produksjon» (avtalen punkt 6 + Vedlegg 3, 16/10). Felt, etiketter,
// prisregning og varsling. Tabell: produksjonsordrer.

export type Nivaa = 'story' | 'film'
export type Stil = 'noytral' | 'luksus' | 'familie' | 'nyetablert'
export type Presentasjon = 'egen' | 'ai' | 'uten'
export type Publisering = 'reelhome' | 'filer'
export type Tidspunkt = 'straks' | 'dato' | 'serie'
export type OrdreStatus = 'mottatt' | 'under_arbeid' | 'til_godkjenning' | 'godkjent' | 'publisert' | 'avbrutt'

export const NIVAA: Record<Nivaa, { navn: string; under: string; pris: number; virkedager: number }> = {
  story: { navn: 'Tekstet story i 9:16', under: 'Uten stemme, teksten bærer budskapet', pris: PRIS.produksjon.story, virkedager: 1 },
  film:  { navn: 'Reel og film med innlest stemme', under: 'Med eller uten avatar, alle formater', pris: PRIS.produksjon.film, virkedager: 2 },
}
export const STIL: Record<Stil, string> = { noytral: 'Nøytral', luksus: 'Luksus', familie: 'Familie', nyetablert: 'Nyetablert' }
export const PRESENTASJON: Record<Presentasjon, string> = { egen: 'Min egen avatar', ai: 'En av AI-meglerne', uten: 'Uten presentør' }
export const TIDSPUNKT: Record<Tidspunkt, string> = { straks: 'Straks etter godkjenning', dato: 'Valgt dato og klokkeslett', serie: 'Serie: story, reel og film på ulike dager' }
export const STATUS: Record<OrdreStatus, string> = {
  mottatt: 'Mottatt', under_arbeid: 'Under arbeid', til_godkjenning: 'Til godkjenning', godkjent: 'Godkjent', publisert: 'Publisert', avbrutt: 'Avbrutt',
}

export type Ordre = {
  id: string
  property_id: string
  organization_id: string | null
  user_id: string
  nivaa: Nivaa
  stil: Stil
  maa_med: string | null
  ikke_nevn: string | null
  pris_visning: string | null
  presentasjon: Presentasjon
  publisering: Publisering
  kanaler: string[]
  tidspunkt: Tidspunkt
  tidspunkt_dato: string | null
  hjem_plakat: boolean
  frist: string | null
  bilder_maa_med: string[]
  bilder_ikke_bruk: string[]
  pris_nok: number
  rabatt_prosent: number
  betaling: 'saldo' | 'stripe' | 'faktura'
  betalt_at: string | null
  status: OrdreStatus
  notat_intern: string | null
  created_at: string
  updated_at: string
}

// Antall bestillinger megleren har gjort denne kalendermåneden (ikke avbrutte).
export async function bestillingerDenneMaaneden(sb: SupabaseClient, userId: string): Promise<number> {
  const { count } = await sb
    .from('produksjonsordrer')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'avbrutt')
    .gte('created_at', maanedStart())
  return count ?? 0
}

// Vedlegg 1: 10 prosent rabatt på femte og senere bestilling i måneden.
export function prisForBestilling(nivaa: Nivaa, tidligereDenneMaaneden: number): { pris: number; rabattProsent: number; listepris: number } {
  const listepris = NIVAA[nivaa].pris
  const rabattProsent = tidligereDenneMaaneden + 1 >= PRIS.produksjonRabattFraBestilling ? PRIS.produksjonRabattProsent : 0
  return { listepris, rabattProsent, pris: Math.round(listepris * (100 - rabattProsent) / 100) }
}

type Ent = { id: string; remaining: number; expires_at: string | null }

// «Vi produserer»-saldo megleren kan trekke fra (egen eller kontorets).
export async function viProdusererSaldo(sb: SupabaseClient, orgId: string | null, userId: string): Promise<Ent[]> {
  if (!orgId) return []
  const { data } = await sb
    .from('bolig_entitlements')
    .select('id, remaining, expires_at')
    .eq('organization_id', orgId)
    .eq('kind', 'vi_produserer')
    .gt('remaining', 0)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('expires_at', { ascending: true, nullsFirst: false })
  const naa = Date.now()
  return ((data ?? []) as Ent[]).filter(e => !e.expires_at || new Date(e.expires_at).getTime() > naa)
}

// Trekk én bolig fra saldo (tekstet story teller som en halv — vi runder opp
// til én for enkelhet i første versjon og noterer det i ordren).
export async function trekkViProduserer(sb: SupabaseClient, ents: Ent[]): Promise<string | null> {
  for (const e of ents) {
    const { data } = await sb
      .from('bolig_entitlements')
      .update({ remaining: e.remaining - 1 })
      .eq('id', e.id)
      .eq('remaining', e.remaining)
      .select('id')
      .maybeSingle()
    if (data) return e.id
  }
  return null
}

export async function varsleOss(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chat = process.env.TELEGRAM_CHAT_ID
  if (!token || !chat) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text }),
    })
  } catch { /* best-effort */ }
}

// Varsel til oss (Telegram + e-post) og kvittering til megleren. Best-effort —
// skal aldri velte bestillingen. Brukes av bestill-ruta (saldo/faktura) og av
// Stripe-webhooken (kort).
export async function etterBestilling(
  ordre: Parameters<typeof ordreSammendrag>[0] & { id: string; frist: string | null },
  bolig: { address: string | null; url: string | null; email: string | null },
) {
  const sammendrag = ordreSammendrag(ordre)
  const tittel = `Ny produksjonsbestilling: ${bolig.address ?? 'bolig'}`
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reelhome.ai'
  await varsleOss(`🎬 ${tittel}\n${bolig.email ?? ''}\n${bolig.url ?? ''}\n${sammendrag}\nAdmin: ${site}/admin/produksjon`)
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY!)
    const linjer = sammendrag.split('\n').map(l => `<li>${l}</li>`).join('')
    const r1 = await resend.emails.send({
      from: 'ReelHome <noreply@reelhome.ai>',
      to: 'hei@reelhome.ai',
      subject: tittel,
      html: `<p>${bolig.email ?? ''}<br>${bolig.url ?? ''}</p><ul>${linjer}</ul><p><a href="${site}/admin/produksjon">Åpne ordrekøen</a></p>`,
    })
    if (r1.error) console.error('[produksjon] varsel-e-post feilet:', r1.error)
    if (bolig.email) {
      const r2 = await resend.emails.send({
        from: 'ReelHome <noreply@reelhome.ai>',
        to: bolig.email,
        replyTo: 'hei@reelhome.ai',
        subject: `Bestillingen din er mottatt — ${bolig.address ?? 'bolig'}`,
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f0f0f">
          <p style="font-size:20px;font-weight:700;margin:0 0 12px">Takk, bestillingen er mottatt</p>
          <p style="font-size:14px;color:#525252;line-height:1.6">Vi lager videoen for <strong>${bolig.address ?? 'boligen'}</strong> og sender deg en forhåndsvisning til godkjenning innen ${NIVAA[ordre.nivaa].virkedager} virkedag${NIVAA[ordre.nivaa].virkedager === 1 ? '' : 'er'}, regnet fra bestilling før klokken 12. Én endringsrunde er inkludert.</p>
          <ul style="font-size:13px;color:#525252;line-height:1.7">${linjer}</ul>
          <p style="font-size:12px;color:#737373">Spørsmål? Svar på denne e-posten.</p>
        </div>`,
      })
      if (r2.error) console.error('[produksjon] kvittering feilet:', r2.error)
    }
  } catch (e) {
    console.error('[produksjon] e-post feilet:', e)
  }
}

export function ordreSammendrag(o: Pick<Ordre, 'nivaa' | 'stil' | 'presentasjon' | 'publisering' | 'kanaler' | 'tidspunkt' | 'tidspunkt_dato' | 'frist' | 'pris_nok' | 'rabatt_prosent' | 'betaling' | 'hjem_plakat'>): string {
  const linjer = [
    `Nivå: ${NIVAA[o.nivaa].navn} (${NIVAA[o.nivaa].virkedager} virkedag${NIVAA[o.nivaa].virkedager === 1 ? '' : 'er'})`,
    `Stil: ${STIL[o.stil]} · Presentør: ${PRESENTASJON[o.presentasjon]}`,
    o.publisering === 'reelhome'
      ? `Publisering via ReelHome: ${o.kanaler.join(', ') || 'ingen kanaler valgt'} · ${TIDSPUNKT[o.tidspunkt]}${o.tidspunkt_dato ? ` (${new Date(o.tidspunkt_dato).toLocaleString('nb-NO')})` : ''}`
      : 'Publisering: bare filer',
    `Hjem.no-plakat: ${o.hjem_plakat ? 'ja' : 'nei'}${o.frist ? ` · Ønsket frist: ${o.frist}` : ''}`,
    `Pris: ${o.pris_nok.toLocaleString('nb-NO')} kr${o.rabatt_prosent ? ` (${o.rabatt_prosent} % rabatt)` : ''} · Betaling: ${o.betaling === 'saldo' ? 'abonnementssaldo' : o.betaling === 'stripe' ? 'kort' : 'faktura'}`,
  ]
  return linjer.join('\n')
}
