import type { SupabaseClient } from '@supabase/supabase-js'

// Fakturaunderlag per organisasjon og måned (21/10, Hjem.no-modellen): én rad
// per bolig tatt i bruk i måneden, med produsent, kilde og pris. Brukes av
// Team-siden (oversikt + CSV-nedlasting). Leser property_unlocks via
// medlemmene, som kontorOversikt — eldre opplåsinger kan mangle
// organization_id.

export type FakturaRad = {
  dato: string            // ISO
  property_id: string
  adresse: string
  annonse: string | null
  produsent: string       // navn, ellers e-post
  epost: string
  kilde: string           // norsk etikett
  pris_nok: number
}

export type Fakturaunderlag = {
  maaned: string          // YYYY-MM
  fra: string             // ISO, inkl.
  til: string             // ISO, ekskl.
  organisasjon: { id: string; navn: string; fakturaKunde: boolean; prisPerBolig: number | null }
  antall: number
  sum_nok: number
  rader: FakturaRad[]
}

export const KILDE_TEKST: Record<string, string> = {
  free_first: 'Gratis første bolig',
  entitlement: 'Abonnement',
  purchase: 'Kjøpt i appen',
  production: 'Produsert av ReelHome',
  admin: 'Uten kostnad',
  faktura: 'Faktureres',
}

/** Godtar «YYYY-MM»; ellers inneværende måned (UTC). */
export function maanedsvindu(maaned?: string | null): { maaned: string; fra: string; til: string } {
  const m = maaned && /^\d{4}-(0[1-9]|1[0-2])$/.test(maaned) ? maaned : new Date().toISOString().slice(0, 7)
  const [y, mo] = m.split('-').map(Number)
  const fra = new Date(Date.UTC(y, mo - 1, 1)).toISOString()
  const til = new Date(Date.UTC(y, mo, 1)).toISOString()
  return { maaned: m, fra, til }
}

export async function hentFakturaunderlag(sb: SupabaseClient, orgId: string, maaned?: string | null): Promise<Fakturaunderlag> {
  const vindu = maanedsvindu(maaned)

  const [{ data: org }, { data: medlemmer }] = await Promise.all([
    sb.from('organizations').select('id, name, faktura_kunde, pris_per_bolig_nok').eq('id', orgId).maybeSingle(),
    sb.from('organization_members').select('user_id').eq('organization_id', orgId),
  ])
  const o = (org ?? {}) as { id?: string; name?: string; faktura_kunde?: boolean | null; pris_per_bolig_nok?: number | null }
  const memberIds = ((medlemmer ?? []) as { user_id: string }[]).map(m => m.user_id)

  const tom: Fakturaunderlag = {
    ...vindu,
    organisasjon: { id: orgId, navn: o.name ?? '', fakturaKunde: !!o.faktura_kunde, prisPerBolig: o.pris_per_bolig_nok ?? null },
    antall: 0, sum_nok: 0, rader: [],
  }
  if (memberIds.length === 0) return tom

  const { data: unlocks } = await sb
    .from('property_unlocks')
    .select('property_id, user_id, source, price_nok, created_at')
    .in('user_id', memberIds)
    .gte('created_at', vindu.fra)
    .lt('created_at', vindu.til)
    .order('created_at', { ascending: true })
  const rows = (unlocks ?? []) as { property_id: string; user_id: string; source: string; price_nok: number | null; created_at: string }[]
  if (rows.length === 0) return tom

  const propIds = Array.from(new Set(rows.map(r => r.property_id)))
  const userIds = Array.from(new Set(rows.map(r => r.user_id)))
  const [{ data: props }, { data: profiles }, auth] = await Promise.all([
    sb.from('properties').select('id, address, hjem_url, finn_url').in('id', propIds),
    sb.from('profiles').select('id, full_name').in('id', userIds),
    sb.auth.admin.listUsers({ perPage: 1000 }),
  ])
  const adr: Record<string, { address: string | null; url: string | null }> = {}
  for (const p of (props ?? []) as { id: string; address: string | null; hjem_url: string | null; finn_url: string | null }[]) {
    adr[p.id] = { address: p.address, url: p.hjem_url || p.finn_url || null }
  }
  const navn: Record<string, string> = {}
  for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) if (p.full_name) navn[p.id] = p.full_name
  const epost: Record<string, string> = {}
  for (const u of auth.data?.users ?? []) if (u.email) epost[u.id] = u.email

  const rader: FakturaRad[] = rows.map(r => ({
    dato: r.created_at,
    property_id: r.property_id,
    adresse: adr[r.property_id]?.address ?? '(adresse mangler)',
    annonse: adr[r.property_id]?.url ?? null,
    produsent: navn[r.user_id] ?? epost[r.user_id] ?? r.user_id,
    epost: epost[r.user_id] ?? '',
    kilde: KILDE_TEKST[r.source] ?? r.source,
    pris_nok: r.price_nok ?? 0,
  }))
  return { ...tom, antall: rader.length, sum_nok: rader.reduce((s, r) => s + r.pris_nok, 0), rader }
}

/** CSV for regneark: semikolon (norsk Excel), UTF-8 med BOM, sumlinje til slutt. */
export function tilCsv(u: Fakturaunderlag): string {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const dato = (iso: string) => new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Oslo' })
  const linjer = [
    ['Dato', 'Adresse', 'Produsent', 'E-post', 'Kilde', 'Pris eks. mva', 'Annonse'].join(';'),
    ...u.rader.map(r => [dato(r.dato), r.adresse, r.produsent, r.epost, r.kilde, r.pris_nok, r.annonse ?? ''].map(esc).join(';')),
    ['Sum', `${u.antall} boliger`, '', '', '', u.sum_nok, ''].map(esc).join(';'),
  ]
  return '﻿' + linjer.join('\r\n') + '\r\n'
}
