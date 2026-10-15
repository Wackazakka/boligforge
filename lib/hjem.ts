// Hjem.no-inngangen (16/10): lese kontor og megler ut av en annonse.
// Samme offentlige API som scraperen på dropleten bruker for selve boligen.

export type HjemAgency = {
  externalId: number
  name: string
  parentId: number | null
  logoUrl: string | null
  iconUrl: string | null
}

export type HjemContact = {
  name: string
  email: string | null
  phone: string | null
  image: string | null
  position: string | null
}

export type HjemListing = {
  hash: string
  refNo: string
  url: string
  title: string
  address: string
  agency: HjemAgency | null
  contacts: HjemContact[]
}

const HJEM_API = 'https://apigw.hjem.no/search-backend/api/v2/properties'

/** Godtar https://hjem.no/property/<refNo>/<hash>[/slug] og https://www.hjem.no/… */
export function parseHjemUrl(input: string): { refNo: string; hash: string; url: string } | null {
  let u: URL
  try { u = new URL(input.trim()) } catch { return null }
  if (!/(^|\.)hjem\.no$/.test(u.hostname)) return null
  const m = u.pathname.match(/\/property\/(\d+)\/([a-f0-9]{16,})/i)
  if (!m) return null
  return { refNo: m[1], hash: m[2].toLowerCase(), url: `https://hjem.no/property/${m[1]}/${m[2].toLowerCase()}` }
}

export async function fetchHjemListing(input: string): Promise<HjemListing | null> {
  const parsed = parseHjemUrl(input)
  if (!parsed) return null
  const res = await fetch(`${HJEM_API}?ids[]=${encodeURIComponent(parsed.hash)}&availability[]=all`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return null
  const json = await res.json().catch(() => null) as unknown
  const list = Array.isArray(json) ? json : (json && typeof json === 'object' && Array.isArray((json as { data?: unknown }).data) ? (json as { data: unknown[] }).data : [])
  const p = list[0] as Record<string, unknown> | undefined
  if (!p) return null

  const a = p.agency as Record<string, unknown> | undefined
  const profile = (a?.profile ?? {}) as Record<string, unknown>
  const agency: HjemAgency | null = a && typeof a.external_id === 'number'
    ? {
        externalId: a.external_id,
        name: String(a.name ?? ''),
        parentId: typeof a.parent_id === 'number' ? a.parent_id : null,
        logoUrl: typeof profile.logo_url === 'string' ? profile.logo_url : null,
        iconUrl: typeof profile.icon_url === 'string' ? profile.icon_url : null,
      }
    : null

  const contacts: HjemContact[] = ((p.contacts as Record<string, unknown>[] | undefined) ?? [])
    .filter(c => c && (c.type === 'agent' || !c.type))
    .map(c => ({
      name: String(c.name ?? '').trim(),
      email: typeof c.email === 'string' && c.email.includes('@') ? c.email.trim().toLowerCase() : null,
      phone: Array.isArray(c.phones) && typeof c.phones[0] === 'string' ? c.phones[0] : null,
      image: typeof c.image === 'string' ? c.image : null,
      position: typeof c.position === 'string' ? c.position : null,
    }))
    .filter(c => c.name)

  // address.display_name = «Lille Kirkholmen 10, 3783 Kragerø Skjærgårdsrute»;
  // de andre feltene er små bokstaver.
  const addr = p.address as Record<string, unknown> | undefined
  const address = typeof addr?.display_name === 'string' && addr.display_name
    ? addr.display_name
    : [addr?.street, addr?.post_code, addr?.postal_place].filter(Boolean).join(', ') || String(p.name ?? '')

  return {
    hash: parsed.hash,
    refNo: parsed.refNo,
    url: parsed.url,
    title: String(p.title ?? p.name ?? ''),
    address,
    agency,
    contacts,
  }
}

/** k***@firma.no — nok til at megleren kjenner igjen sin egen adresse. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return `${local.slice(0, 1)}***@${domain}`
}
