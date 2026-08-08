import { createClient } from '@supabase/supabase-js'

// Kjede-merkevarestyring: en megler i en kjede skal ikke kunne bryte det
// felles uttrykket. Har kjeden (eller kontoret) satt en offisiell logo, er
// den gjeldende — og den personlige opplastingen forsvinner i UI-et.
//
// Rekkefølge (mest overordnet vinner):
//   kjedens logo  →  kontorets logo  →  meglerens egen
export type EffectiveLogo = {
  url: string | null
  /** Satt av en organisasjon (kjede/kontor) — da kan ikke medlemmene overstyre */
  locked: boolean
  /** Arvet fra en OVERORDNET kjede — da kan heller ikke kontorsjefen endre den */
  fromParent: boolean
  /** Navnet på organisasjonen som eier logoen — vises i UI-et */
  source: string | null
}

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function resolveLogo(userId: string, ownLogoUrl?: string | null): Promise<EffectiveLogo> {
  try {
    const s = svc()
    const { data: prof } = await s.from('profiles').select('organization_id').eq('id', userId).maybeSingle()
    const orgId = (prof as { organization_id?: string | null } | null)?.organization_id
    if (!orgId) return { url: ownLogoUrl ?? null, locked: false, fromParent: false, source: null }

    const { data: org } = await s.from('organizations')
      .select('name, logo_url, parent_organization_id').eq('id', orgId).maybeSingle()
    const o = org as { name?: string; logo_url?: string | null; parent_organization_id?: string | null } | null

    // Kjeden først — et kontor skal ikke kunne overstyre kjedens uttrykk
    if (o?.parent_organization_id) {
      const { data: chain } = await s.from('organizations')
        .select('name, logo_url').eq('id', o.parent_organization_id).maybeSingle()
      const c = chain as { name?: string; logo_url?: string | null } | null
      if (c?.logo_url) return { url: c.logo_url, locked: true, fromParent: true, source: c.name ?? 'kjeden' }
    }
    // Egen organisasjons logo: låst for medlemmene, men org-ens admin eier den
    if (o?.logo_url) return { url: o.logo_url, locked: true, fromParent: false, source: o.name ?? 'meglerhuset' }

    return { url: ownLogoUrl ?? null, locked: false, fromParent: false, source: null }
  } catch (e) {
    console.error('[org-branding] logo-oppslag feilet:', e)
    return { url: ownLogoUrl ?? null, locked: false, fromParent: false, source: null }
  }
}

/** Er brukeren admin (byråsjef/kontorsjef/kjedeadmin) i sin egen organisasjon? */
export async function orgAdminOf(userId: string): Promise<string | null> {
  try {
    const s = svc()
    const { data } = await s.from('organization_members')
      .select('organization_id, role').eq('user_id', userId)
    const rows = (data ?? []) as { organization_id: string; role: string }[]
    const admin = rows.find(r => r.role === 'admin')
    return admin?.organization_id ?? null
  } catch {
    return null
  }
}
