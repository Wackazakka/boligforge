// Konto-sharding for ElevenLabs.
//
// Bakgrunn: én ElevenLabs-konto har et HARDT tak på stemmeplasser (Creator 30,
// Pro 160, Scale/Business 660). hjem.no representerer ~3 500 meglere, så én
// konto rekker ikke ved full utrulling. Enterprise er riktig langsiktig svar,
// men dette gir en kortsiktig vei: flere abonnementer, og hver megler bindes
// til kontoen stemmen faktisk bor på.
//
// Oppsett: ELEVENLABS_API_KEY (standard/primær) + valgfritt
// ELEVENLABS_ACCOUNTS = "b:sk_xxx,c:sk_yyy" (kort konto-id → nøkkel).
// Uten ELEVENLABS_ACCOUNTS oppfører alt seg nøyaktig som før.

export const PRIMARY_ACCOUNT = 'a'

function parseAccounts(): Record<string, string> {
  const map: Record<string, string> = {}
  const primary = process.env.ELEVENLABS_API_KEY
  if (primary) map[PRIMARY_ACCOUNT] = primary
  for (const pair of (process.env.ELEVENLABS_ACCOUNTS || '').split(',')) {
    const [id, key] = pair.split(':').map(s => s?.trim())
    if (id && key) map[id] = key
  }
  return map
}

/** Nøkkelen for en gitt konto-id. Ukjent/manglende id → primærkontoen. */
export function keyForAccount(account?: string | null): string {
  const map = parseAccounts()
  return (account && map[account]) || map[PRIMARY_ACCOUNT] || ''
}

/** Alle konfigurerte konto-id-er, primær først. */
export function allAccounts(): string[] {
  const map = parseAccounts()
  return [PRIMARY_ACCOUNT, ...Object.keys(map).filter(a => a !== PRIMARY_ACCOUNT)].filter(a => map[a])
}

/**
 * Velger konto for en NY stemmeklone: første konto med ledig plass.
 * Spør ElevenLabs om faktisk forbruk i stedet for å telle selv — kontoene kan
 * brukes av andre produkter (ContentForge deler nøkkel-økosystem).
 */
export async function pickAccountWithCapacity(): Promise<{ account: string; key: string } | null> {
  for (const account of allAccounts()) {
    const key = keyForAccount(account)
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        headers: { 'xi-api-key': key },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const sub = await res.json()
      const used = sub.voice_slots_used ?? 0
      const limit = sub.voice_limit ?? 0
      const opsLeft = (sub.max_voice_add_edits ?? 0) - (sub.voice_add_edit_counter ?? 0)
      if (used < limit && opsLeft > 0) return { account, key }
      console.warn(`[elevenlabs] konto ${account} full: ${used}/${limit} plasser, ${opsLeft} operasjoner igjen`)
    } catch (e) {
      console.error(`[elevenlabs] kunne ikke sjekke konto ${account}:`, e)
    }
  }
  return null
}
