'use client'

// Mottaksside for invitasjons-e-poster (team, org og kjede/kontor).
// Supabase-verify redirecter hit med sesjonstokener i URL-en (hash eller
// ?code=) — createBrowserClient konsumerer dem og skriver cookie-sesjonen.
// Deretter provisjonerer /api/auth/accept-invite profil + medlemskap fra
// invite-metadataene, og brukeren sendes videre til avatar-oppsettet.
// (Før landet invitasjoner på /onboarding, som aldri plukket opp tokenene —
// den inviterte forble uinnlogget/uprovisjonert.)

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function AcceptInvitePage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let cancelled = false

    async function run() {
      // Vent til klienten har konsumert tokenene fra URL-en (maks ~10 s)
      let session = null
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession()
        session = data.session
        if (session || cancelled) break
        await new Promise(r => setTimeout(r, 500))
      }
      if (cancelled) return
      if (!session) {
        setError('Fant ingen gyldig invitasjon i lenken. Lenken kan være brukt eller utløpt — be om en ny invitasjon.')
        return
      }

      const res = await fetch('/api/auth/accept-invite', { method: 'POST' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error ?? 'Kunne ikke fullføre invitasjonen. Prøv igjen, eller be om en ny invitasjon.')
        return
      }
      window.location.replace(body?.next ?? '/onboarding/avatar')
    }

    run()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
      <div className="app-card" style={{ width: '100%', maxWidth: '420px', padding: '40px', textAlign: 'center' }}>
        {!error ? (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '8px' }}>
              Aktiverer invitasjonen din…
            </h1>
            <p style={{ fontSize: '14px', color: '#737373' }}>
              Et øyeblikk — vi kobler deg til teamet ditt.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '8px' }}>
              Noe gikk galt
            </h1>
            <p style={{ fontSize: '14px', color: '#737373', marginBottom: '20px' }}>{error}</p>
            <Link href="/auth/login" style={{ fontSize: '14px', color: '#2563eb', textDecoration: 'none' }}>
              Gå til innlogging →
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
