// Avatar-tilgang (Spor C): avatar-rutene godtar ENTEN megler-innlogging (testing)
// ELLER en gyldig visningstoken (kjøper som har meldt seg på via porten).
import { getUser } from '../supabase/server'
import { serviceClient } from './rag'

export type AvatarAccess = { ok: boolean; signupId?: string; isMegler?: boolean }

export async function resolveAvatarAccess(
  propertyId: string,
  viewingToken?: string | null,
): Promise<AvatarAccess> {
  // Megler (innlogget) — full tilgang for testing
  const user = await getUser()
  if (user) return { ok: true, isMegler: true }

  // Kjøper med gyldig visningstoken: riktig eiendom, samtykke gitt, ikke utløpt
  if (viewingToken) {
    const svc = serviceClient()
    const { data: s } = await svc
      .from('reelhome_viewing_signups')
      .select('id, property_id, expires_at, consent_at')
      .eq('token', viewingToken)
      .maybeSingle()
    if (s && s.property_id === propertyId && s.consent_at && new Date(s.expires_at) > new Date()) {
      return { ok: true, signupId: s.id }
    }
  }
  return { ok: false }
}
