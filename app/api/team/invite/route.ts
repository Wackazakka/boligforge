import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'E-post mangler' }, { status: 400 })

  const client = sb()

  // Verify caller is admin — organization_members er kilden til sannhet for
  // org-medlemskap (samme som /api/org/* og team/members), ikke profiles.
  const { data: profile } = await client
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile?.organization_id || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Kun admin kan invitere meglere' }, { status: 403 })
  }

  // Get org name
  const { data: org } = await client
    .from('organizations')
    .select('name')
    .eq('id', profile.organization_id)
    .maybeSingle()

  const orgName = org?.name ?? 'ReelHome'

  // Send invite via Supabase Auth (creates account + magic link)
  const { data: inviteData, error: inviteError } = await client.auth.admin.inviteUserByEmail(
    email.trim(),
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding?org=${profile.organization_id}`,
      data: {
        organization_id: profile.organization_id,
        invited_by:      user.id,
        role:            'agent',
      },
    }
  )

  if (inviteError) {
    // If user already exists, send a custom Resend invite email instead
    if (inviteError.message.includes('already been registered') || inviteError.message.includes('already exists')) {
      try {
        await getResend().emails.send({
          from:    'ReelHome <hei@reelhome.ai>',
          to:      email.trim(),
          subject: `Du er invitert til ${orgName} på ReelHome`,
          html: `
            <p>Hei,</p>
            <p>Du er invitert til å bli med i <strong>${orgName}</strong> på ReelHome.</p>
            <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/auth/login" style="color:#2563eb">Logg inn her →</a></p>
            <p style="color:#6b7280;font-size:12px">ReelHome — AI-drevne presentasjonsvideoer for eiendomsmeglere</p>
          `,
        })
        return NextResponse.json({ success: true, note: 'existing_user_notified' })
      } catch (resendErr) {
        return NextResponse.json({ error: 'Brukeren finnes allerede. Resend feilet: ' + String(resendErr) }, { status: 500 })
      }
    }
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  // If new user was created, pre-set their org in profiles when they sign up
  // (handled by onboarding callback reading the org param in redirectTo)

  // Also send a friendly branded email via Resend on top of Supabase's invite
  try {
    await getResend().emails.send({
      from:    'ReelHome <hei@reelhome.no>',
      to:      email.trim(),
      subject: `Du er invitert til ${orgName} på ReelHome`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#0b0b0c">Velkommen til ReelHome! 🎬</h2>
          <p>Du er invitert til å bli med i <strong>${orgName}</strong>.</p>
          <p>Klikk på lenken i e-posten fra Supabase/ReelHome for å opprette din konto og sette opp din profil.</p>
          <p style="color:#6b7280;font-size:12px">ReelHome — AI-drevne presentasjonsvideoer for eiendomsmeglere</p>
        </div>
      `,
    })
  } catch {
    // Resend failure is non-critical — Supabase already sent the invite email
    console.warn('[team/invite] Resend email failed (non-critical)')
  }

  return NextResponse.json({ success: true, userId: inviteData?.user?.id })
}
