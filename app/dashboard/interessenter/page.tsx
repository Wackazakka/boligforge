import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '../../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Interessenter — leads registrert av boligsamtalen («Spør om boligen» /
// digital visning). Tabellen skrives av chat-hjernen (registrer_interessent);
// denne siden er meglerens innsyn. Radene utløper 7 dager etter samtykke.

export const dynamic = 'force-dynamic'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

type Lead = {
  id: string
  property_id: string
  buyer_name: string
  buyer_phone: string | null
  buyer_email: string | null
  buyer_message: string | null
  consent_at: string
  expires_at: string
}

export default async function InteressenterPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Meglerens boliger: eier eller oppført som megler
  const { data: props } = await serviceSupabase
    .from('properties')
    .select('id, address')
    .or(`user_id.eq.${user.id},agent_id.eq.${user.id}`)

  const propMap = new Map((props ?? []).map(p => [p.id, (p.address ?? '').split(',')[0].trim()]))
  const propIds = [...propMap.keys()]

  let leads: Lead[] = []
  if (propIds.length > 0) {
    const { data } = await serviceSupabase
      .from('reelhome_viewing_signups')
      .select('id, property_id, buyer_name, buyer_phone, buyer_email, buyer_message, consent_at, expires_at')
      .in('property_id', propIds)
      .gt('expires_at', new Date().toISOString())
      .order('consent_at', { ascending: false })
      .limit(100)
    leads = (data ?? []) as Lead[]
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="p-6">
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
          Interessenter
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '28px' }}>
          Kjøpere som har registrert seg i boligsamtalen. Kontaktinfoen er samlet inn med
          samtykke og slettes automatisk 7 dager etter registrering — følg opp raskt.
        </p>

        {leads.length === 0 ? (
          <div className="app-card" style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              Ingen aktive interessenter akkurat nå
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Når en kjøper ber om visning eller kontakt i boligsamtalen, dukker de opp her —
              og du får e-post med en gang.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {leads.map(l => (
              <div key={l.id} className="app-card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>{l.buyer_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted-2)' }}>{fmt(l.consent_at)}</div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
                  <Link href={`/dashboard/properties/${l.property_id}`} style={{ color: 'var(--blue)', textDecoration: 'none' }}>
                    {propMap.get(l.property_id) ?? 'Ukjent bolig'}
                  </Link>
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--ink)' }}>
                  {l.buyer_phone && <span>📞 <a href={`tel:${l.buyer_phone}`} style={{ color: 'inherit' }}>{l.buyer_phone}</a></span>}
                  {l.buyer_email && <span>✉️ <a href={`mailto:${l.buyer_email}`} style={{ color: 'inherit' }}>{l.buyer_email}</a></span>}
                </div>
                {l.buyer_message && (
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px', fontStyle: 'italic' }}>
                    «{l.buyer_message}»
                  </p>
                )}
                <p style={{ fontSize: '11px', color: 'var(--muted-2)', marginTop: '8px' }}>
                  Slettes {new Date(l.expires_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
