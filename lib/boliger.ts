import type { SupabaseClient } from '@supabase/supabase-js'

// Bolig-modellen (avtalen med hjem.no, 15/10/2026). En bolig låses opp ÉN gang,
// og deretter er alle formater og regenereringer på den fri. Dette erstatter
// video_credits (per video). Se supabase/migrations/20261016_bolig_modell.sql.
//
// Prisene her er Vedlegg 1 i avtalen. Endres de, endres de HER — UI og API
// leser herfra.

export const PRIS = {
  // Megleren lager selv, per bolig, etter antall boliger i kalendermåneden.
  selv: [
    { fra: 1,  pris: 790 },
    { fra: 5,  pris: 690 },
    { fra: 10, pris: 590 },
  ],
  // Produksjon utført av oss.
  produksjon: {
    story: 1490, // tekstet story 9:16
    film:  2490, // reel + film med innlest stemme, med eller uten avatar
  },
  produksjonRabattFraBestilling: 5, // 10 % fra femte bestilling i måneden
  produksjonRabattProsent: 10,
  ekstraEndringsrunde: 490,
} as const

export type AbonnementId = 'lag_selv_medlem' | 'lag_selv_kontor' | 'vi_produserer_medlem' | 'vi_produserer_kontor'
export type Kind  = 'lag_selv' | 'vi_produserer'
export type Scope = 'medlem' | 'kontor'

export const ABONNEMENTER: Record<AbonnementId, {
  id: AbonnementId
  navn: string
  kind: Kind
  scope: Scope
  boligerPerMnd: number
  prisPerMnd: number
  beskrivelse: string
}> = {
  lag_selv_medlem:      { id: 'lag_selv_medlem',      navn: 'Lag selv · Megler',      kind: 'lag_selv',      scope: 'medlem', boligerPerMnd: 4,  prisPerMnd: 2490,  beskrivelse: '4 boliger i måneden du lager selv' },
  lag_selv_kontor:      { id: 'lag_selv_kontor',      navn: 'Lag selv · Kontor',      kind: 'lag_selv',      scope: 'kontor', boligerPerMnd: 15, prisPerMnd: 7990,  beskrivelse: '15 boliger i måneden, delt mellom kontorets meglere' },
  vi_produserer_medlem: { id: 'vi_produserer_medlem', navn: 'Vi produserer · Megler', kind: 'vi_produserer', scope: 'medlem', boligerPerMnd: 2,  prisPerMnd: 3990,  beskrivelse: '2 boliger i måneden produsert av oss, med stemme eller avatar' },
  vi_produserer_kontor: { id: 'vi_produserer_kontor', navn: 'Vi produserer · Kontor', kind: 'vi_produserer', scope: 'kontor', boligerPerMnd: 8,  prisPerMnd: 14990, beskrivelse: '8 boliger i måneden produsert av oss, delt mellom kontorets meglere' },
}

// Stripe-prisen for et abonnement slås opp på lookup_key, ikke env-var
// (opprettet i testmodus 16/10 med scratch-skriptet stripe-setup-priser.mjs).
export function stripeLookupKey(id: AbonnementId) {
  return `reelhome_${id}`
}

// Boliger utover abonnementet koster abonnementets pris per bolig (Vedlegg 1).
export function prisPerBoligIAbonnement(a: AbonnementId): number {
  const ab = ABONNEMENTER[a]
  return Math.round(ab.prisPerMnd / ab.boligerPerMnd)
}

// Pris for NESTE selvlagde bolig gitt hvor mange megleren alt har låst opp
// denne kalendermåneden (gratisboligen teller med i antallet).
export function prisForNesteBolig(antallDenneMaaneden: number): number {
  const neste = antallDenneMaaneden + 1
  let pris: number = PRIS.selv[0].pris
  for (const trinn of PRIS.selv) if (neste >= trinn.fra) pris = trinn.pris
  return pris
}

export function maanedStart(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

// «Overføres til neste måned»: en saldo-post fra periode P gjelder ut P+1.
export function utloperEtterNesteMaaned(periodStart = new Date()): string {
  return new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 2, 1)).toISOString()
}

export type UnlockSource = 'free_first' | 'entitlement' | 'purchase' | 'production' | 'admin'

export type Unlock = {
  id: string
  property_id: string
  organization_id: string | null
  user_id: string
  source: UnlockSource
  entitlement_id: string | null
  price_nok: number
  created_at: string
}

export type Saldo = {
  organizationId: string | null
  gratisBoligIgjen: boolean
  boligerDenneMaaneden: number       // selvlagde boliger låst opp av megleren denne måneden
  nestePris: number                   // det neste bolig koster uten saldo
  lagSelv: { igjen: number; utloperForst: string | null }
  viProduserer: { igjen: number; utloperForst: string | null }
  abonnementer: { id: string; kind: Kind; scope: Scope; boliger_per_month: number; price_nok_month: number; status: string; user_id: string | null }[]
}

async function orgIdFor(sb: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await sb
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  return data?.organization_id ?? null
}

async function hentUnlock(sb: SupabaseClient, propertyId: string): Promise<Unlock | null> {
  const { data } = await sb.from('property_unlocks').select('*').eq('property_id', propertyId).maybeSingle()
  return (data as Unlock | null) ?? null
}

export async function harGratisIgjen(sb: SupabaseClient, userId: string): Promise<boolean> {
  const { count } = await sb
    .from('property_unlocks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'free_first')
  return (count ?? 0) === 0
}

export async function boligerDenneMaaneden(sb: SupabaseClient, userId: string): Promise<number> {
  const { count } = await sb
    .from('property_unlocks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('source', 'production')
    .gte('created_at', maanedStart())
  return count ?? 0
}

type EntitlementRow = { id: string; remaining: number; expires_at: string | null; kind: Kind; user_id: string | null }

// Saldo-poster megleren kan trekke fra: egne (user_id = megler) og kontorets
// (user_id null), ikke utløpt, med noe igjen. Eldste utløp først.
async function tilgjengeligeEntitlements(sb: SupabaseClient, orgId: string, userId: string, kind: Kind): Promise<EntitlementRow[]> {
  const { data } = await sb
    .from('bolig_entitlements')
    .select('id, remaining, expires_at, kind, user_id')
    .eq('organization_id', orgId)
    .eq('kind', kind)
    .gt('remaining', 0)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('expires_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  // Utløp filtreres her (ikke som et andre .or() — PostgREST tar bare ett).
  const naa = Date.now()
  return ((data ?? []) as EntitlementRow[]).filter(r => !r.expires_at || new Date(r.expires_at).getTime() > naa)
}

export type EnsureResult =
  | { ok: true; unlock: Unlock; ny: boolean }
  | { ok: false; code: 'NOT_OWNER' }
  | { ok: false; code: 'BOLIG_IKKE_BETALT'; pris: number; boligerDenneMaaneden: number }

// Porten foran videogenerering. Rekkefølge: alt opplåst → første bolig gratis →
// trekk fra saldo («Lag selv») → ellers må boligen kjøpes.
export async function ensureUnlocked(sb: SupabaseClient, userId: string, propertyId: string): Promise<EnsureResult> {
  const { data: prop } = await sb.from('properties').select('id, user_id, organization_id').eq('id', propertyId).maybeSingle()
  if (!prop || prop.user_id !== userId) return { ok: false, code: 'NOT_OWNER' }

  const eksisterende = await hentUnlock(sb, propertyId)
  if (eksisterende) return { ok: true, unlock: eksisterende, ny: false }

  const orgId = (prop.organization_id as string | null) ?? await orgIdFor(sb, userId)
  if (orgId && !prop.organization_id) {
    await sb.from('properties').update({ organization_id: orgId }).eq('id', propertyId)
  }

  // 1. Første bolig gratis. Den partielle unike indeksen stopper nummer to
  //    selv ved samtidige kall — da faller vi videre til saldo/kjøp.
  if (await harGratisIgjen(sb, userId)) {
    const { data, error } = await sb
      .from('property_unlocks')
      .insert({ property_id: propertyId, organization_id: orgId, user_id: userId, source: 'free_first', price_nok: 0 })
      .select('*')
      .single()
    if (!error && data) return { ok: true, unlock: data as Unlock, ny: true }
    if (error && error.code === '23505') {
      // Enten boligen (annen samtidig generering) eller gratisboligen er alt tatt.
      const igjen = await hentUnlock(sb, propertyId)
      if (igjen) return { ok: true, unlock: igjen, ny: false }
    }
  }

  // 2. Saldo fra «Lag selv»-abonnement eller kjøpt pakke.
  if (orgId) {
    for (const e of await tilgjengeligeEntitlements(sb, orgId, userId, 'lag_selv')) {
      const { data: trukket } = await sb
        .from('bolig_entitlements')
        .update({ remaining: e.remaining - 1 })
        .eq('id', e.id)
        .eq('remaining', e.remaining) // optimistisk lås: tapte vi løpet, prøv neste post
        .select('id')
        .maybeSingle()
      if (!trukket) continue
      const { data, error } = await sb
        .from('property_unlocks')
        .insert({ property_id: propertyId, organization_id: orgId, user_id: userId, source: 'entitlement', entitlement_id: e.id, price_nok: 0 })
        .select('*')
        .single()
      if (!error && data) return { ok: true, unlock: data as Unlock, ny: true }
      // Boligen ble låst opp av et samtidig kall: gi tilbake trekket.
      await sb.from('bolig_entitlements').update({ remaining: e.remaining }).eq('id', e.id)
      const igjen = await hentUnlock(sb, propertyId)
      if (igjen) return { ok: true, unlock: igjen, ny: false }
    }
  }

  // 3. Må kjøpes.
  const antall = await boligerDenneMaaneden(sb, userId)
  return { ok: false, code: 'BOLIG_IKKE_BETALT', pris: prisForNesteBolig(antall), boligerDenneMaaneden: antall }
}

// Låser opp etter betaling/manuelt. Idempotent på property_id.
export async function unlockProperty(
  sb: SupabaseClient,
  args: { propertyId: string; userId: string; source: Exclude<UnlockSource, 'free_first' | 'entitlement'>; priceNok: number; stripeSessionId?: string },
): Promise<Unlock | null> {
  const eksisterende = await hentUnlock(sb, args.propertyId)
  if (eksisterende) return eksisterende
  const orgId = await orgIdFor(sb, args.userId)
  const { data } = await sb
    .from('property_unlocks')
    .insert({
      property_id: args.propertyId, organization_id: orgId, user_id: args.userId,
      source: args.source, price_nok: args.priceNok, stripe_session_id: args.stripeSessionId ?? null,
    })
    .select('*')
    .maybeSingle()
  if (data) await sb.from('properties').update({ organization_id: orgId }).eq('id', args.propertyId).is('organization_id', null)
  return (data as Unlock | null) ?? await hentUnlock(sb, args.propertyId)
}

export async function hentSaldo(sb: SupabaseClient, userId: string): Promise<Saldo> {
  const orgId = await orgIdFor(sb, userId)
  const [gratis, antall] = await Promise.all([harGratisIgjen(sb, userId), boligerDenneMaaneden(sb, userId)])

  const sum = (rows: EntitlementRow[]) => ({
    igjen: rows.reduce((s, r) => s + r.remaining, 0),
    utloperForst: rows.find(r => r.expires_at)?.expires_at ?? null,
  })

  let lagSelv = { igjen: 0, utloperForst: null as string | null }
  let viProduserer = { igjen: 0, utloperForst: null as string | null }
  let abonnementer: Saldo['abonnementer'] = []
  if (orgId) {
    const [ls, vp, abo] = await Promise.all([
      tilgjengeligeEntitlements(sb, orgId, userId, 'lag_selv'),
      tilgjengeligeEntitlements(sb, orgId, userId, 'vi_produserer'),
      sb.from('bolig_subscriptions')
        .select('id, kind, scope, boliger_per_month, price_nok_month, status, user_id')
        .eq('organization_id', orgId)
        .neq('status', 'cancelled')
        .or(`user_id.is.null,user_id.eq.${userId}`),
    ])
    lagSelv = sum(ls)
    viProduserer = sum(vp)
    abonnementer = (abo.data ?? []) as Saldo['abonnementer']
  }

  return {
    organizationId: orgId,
    gratisBoligIgjen: gratis,
    boligerDenneMaaneden: antall,
    nestePris: prisForNesteBolig(antall),
    lagSelv,
    viProduserer,
    abonnementer,
  }
}

// Kontor-oversikt: boliger låst opp per megler denne måneden + kontorets saldo.
export async function kontorOversikt(sb: SupabaseClient, orgId: string, memberIds: string[]) {
  const [unlocks, ents] = await Promise.all([
    memberIds.length
      ? sb.from('property_unlocks').select('user_id, source, price_nok').in('user_id', memberIds).gte('created_at', maanedStart())
      : Promise.resolve({ data: [] as { user_id: string; source: string; price_nok: number }[] }),
    sb.from('bolig_entitlements')
      .select('kind, remaining, user_id, expires_at')
      .eq('organization_id', orgId)
      .gt('remaining', 0),
  ])
  const naa = Date.now()
  const perMegler: Record<string, { boliger: number; produksjoner: number; kostnad: number }> = {}
  for (const u of (unlocks.data ?? []) as { user_id: string; source: string; price_nok: number }[]) {
    const m = perMegler[u.user_id] ?? (perMegler[u.user_id] = { boliger: 0, produksjoner: 0, kostnad: 0 })
    if (u.source === 'production') m.produksjoner += 1
    else m.boliger += 1
    m.kostnad += u.price_nok ?? 0
  }
  const saldo = { lagSelv: 0, viProduserer: 0 }
  for (const e of (ents.data ?? []) as { kind: Kind; remaining: number; expires_at: string | null }[]) {
    if (e.expires_at && new Date(e.expires_at).getTime() <= naa) continue
    if (e.kind === 'lag_selv') saldo.lagSelv += e.remaining
    else saldo.viProduserer += e.remaining
  }
  return { perMegler, saldo }
}
