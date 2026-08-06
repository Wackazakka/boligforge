// E-postvarsel til megleren når chat-/avatar-hjernen registrerer en interessent.
// Kalles fire-and-forget fra brain-rutene ETTER vellykket insert — må ALDRI
// kaste: chat-svaret til kjøperen skal ikke feile på e-postproblemer.

import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

type Lead = { navn: string; telefon?: string; epost?: string; melding?: string }

export async function notifyAgentOfLead(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  property: { agent_id?: string | null; user_id?: string | null; address?: string | null },
  lead: Lead
): Promise<void> {
  try {
    const meglerId = property.agent_id || property.user_id
    if (!meglerId || !process.env.RESEND_API_KEY) return

    const { data: userData } = await client.auth.admin.getUserById(meglerId)
    const to = userData?.user?.email
    if (!to) return

    const address = property.address?.split(',')[0].trim() || 'boligen din'
    const lines = [
      `Ny interessent for ${address}:`,
      '',
      `Navn: ${lead.navn}`,
      lead.telefon ? `Telefon: ${lead.telefon}` : null,
      lead.epost ? `E-post: ${lead.epost}` : null,
      lead.melding ? `Spørsmål/beskjed: ${lead.melding}` : null,
      '',
      'Registrert via boligsamtalen (digital visning / «Spør om boligen»).',
      'Se alle interessenter: https://reelhome.ai/dashboard/interessenter',
      '',
      'Kontaktinfoen er samlet inn med samtykke og slettes automatisk etter 7 dager — følg opp raskt.',
    ].filter((l): l is string => l !== null)

    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'ReelHome <hei@reelhome.ai>',
      to,
      subject: `Ny interessent: ${address}`,
      text: lines.join('\n'),
    })
  } catch (e) {
    console.error('[leadNotify] varsling feilet (leadet er lagret):', e)
  }
}
