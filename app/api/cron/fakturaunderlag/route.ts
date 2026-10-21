import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hentFakturaunderlag, tilCsv, type Fakturaunderlag } from '../../../../lib/fakturaunderlag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Automatisk fakturaunderlag (21/10, Hjem.no-modellen). Kjøres av GitHub
// Actions den første i måneden (.github/workflows/fakturaunderlag.yml) og
// sender forrige måneds underlag for hver fakturakunde som e-post til
// hei@reelhome.ai med CSV vedlagt. Idempotent per organisasjon og måned via
// fakturaunderlag_sendt; ?force=1 sender på nytt, ?maaned=YYYY-MM velger måned.
//
// Krever x-cron-secret (eller ?secret=) lik CRON_SECRET — strengere enn de
// andre cron-rutene, siden denne sender e-post.

const MOTTAKERE = ['hei@reelhome.ai']

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } })
}

function forrigeMaaned(): string {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)
}

const nb = (n: number) => n.toLocaleString('nb-NO')
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

function maanedNavn(m: string) {
  return new Date(`${m}-01T00:00:00Z`).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function html(u: Fakturaunderlag): string {
  const dato = (iso: string) => new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Oslo' })
  const rader = u.rader.map(r =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${dato(r.dato)}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee">${r.annonse ? `<a href="${esc(r.annonse)}">${esc(r.adresse)}</a>` : esc(r.adresse)}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(r.produsent)}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(r.kilde)}</td>` +
    `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${nb(r.pris_nok)}</td></tr>`,
  ).join('')
  const pris = u.organisasjon.prisPerBolig ? ` · ${nb(u.organisasjon.prisPerBolig)} kr per bolig` : ''
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#0f0f0f">
    <p style="font-size:20px;font-weight:700;margin:0 0 4px">Fakturaunderlag ${esc(u.organisasjon.navn)} — ${maanedNavn(u.maaned)}</p>
    <p style="margin:0 0 16px;color:#555">${u.antall} boliger tatt i bruk · <b>${nb(u.sum_nok)} kr eks. mva</b>${pris}. CSV ligger vedlagt.</p>
    ${u.antall === 0
      ? '<p>Ingen boliger ble tatt i bruk denne måneden. Ingenting å fakturere.</p>'
      : `<table style="border-collapse:collapse;width:100%;font-size:13px">
          <thead><tr style="text-align:left;background:#f5f5f5">
            <th style="padding:6px 10px">Dato</th><th style="padding:6px 10px">Adresse</th><th style="padding:6px 10px">Produsent</th><th style="padding:6px 10px">Kilde</th><th style="padding:6px 10px;text-align:right">Pris</th>
          </tr></thead>
          <tbody>${rader}</tbody>
          <tfoot><tr><td colspan="4" style="padding:8px 10px;font-weight:700">Sum</td><td style="padding:8px 10px;font-weight:700;text-align:right">${nb(u.sum_nok)} kr</td></tr></tfoot>
        </table>`}
    <p style="margin-top:20px;font-size:12px;color:#888">Sendt automatisk av ReelHome den første i måneden. Samme underlag ligger under Team → Fakturaunderlag.</p>
  </div>`
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret')
  if (!secret || provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const maaned = url.searchParams.get('maaned') || forrigeMaaned()
  const force = url.searchParams.get('force') === '1'
  const sb = svc()

  const { data: orgs } = await sb.from('organizations').select('id, name').eq('faktura_kunde', true)
  const resultat: { org: string; maaned: string; status: string; antall?: number; sum_nok?: number; id?: string | null; feil?: string }[] = []

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY!)

  for (const o of (orgs ?? []) as { id: string; name: string }[]) {
    if (!force) {
      const { data: alt } = await sb.from('fakturaunderlag_sendt').select('id').eq('organization_id', o.id).eq('maaned', maaned).maybeSingle()
      if (alt) { resultat.push({ org: o.name, maaned, status: 'alt sendt' }); continue }
    }
    try {
      const u = await hentFakturaunderlag(sb, o.id, maaned)
      const slug = (o.name || 'organisasjon').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const r = await resend.emails.send({
        from: 'ReelHome <noreply@reelhome.ai>',
        to: MOTTAKERE,
        subject: `Fakturaunderlag ${o.name} – ${maanedNavn(maaned)}: ${u.antall} boliger, ${nb(u.sum_nok)} kr`,
        html: html(u),
        attachments: [{ filename: `fakturaunderlag-${slug}-${maaned}.csv`, content: Buffer.from(tilCsv(u), 'utf8'), contentType: 'text/csv' }],
      })
      // Resend kaster ikke — feil ligger i r.error (lærdom fra tidligere).
      if (r.error) {
        resultat.push({ org: o.name, maaned, status: 'feil', feil: r.error.message })
        continue
      }
      await sb.from('fakturaunderlag_sendt').upsert(
        { organization_id: o.id, maaned, antall: u.antall, sum_nok: u.sum_nok, mottakere: MOTTAKERE, resend_id: r.data?.id ?? null, sent_at: new Date().toISOString() },
        { onConflict: 'organization_id,maaned' },
      )
      resultat.push({ org: o.name, maaned, status: 'sendt', antall: u.antall, sum_nok: u.sum_nok, id: r.data?.id ?? null })
    } catch (e) {
      resultat.push({ org: o.name, maaned, status: 'feil', feil: e instanceof Error ? e.message : String(e) })
    }
  }
  const feil = resultat.some(r => r.status === 'feil')
  return NextResponse.json({ maaned, resultat }, { status: feil ? 500 : 200 })
}

export async function GET(request: Request) { return run(request) }
export async function POST(request: Request) { return run(request) }
