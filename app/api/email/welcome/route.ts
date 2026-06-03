import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const getResend = () => new Resend(process.env.RESEND_API_KEY!)

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Supabase webhook payload shape (INSERT on profiles)
interface WebhookPayload {
  type:       'INSERT' | 'UPDATE' | 'DELETE'
  table:      string
  schema:     string
  record:     { id: string; full_name: string | null; [key: string]: unknown }
  old_record: null | Record<string, unknown>
}

export async function POST(req: NextRequest) {
  // ── 1. Verify request comes from Supabase ──────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const secret     = process.env.SUPABASE_WEBHOOK_SECRET ?? ''

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse payload ───────────────────────────────────────────────────────
  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.type !== 'INSERT' || payload.table !== 'profiles') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const userId   = payload.record.id
  const fullName = payload.record.full_name?.trim() ?? ''
  const firstName = fullName.split(' ')[0] || 'der'

  // ── 3. Fetch email from auth.users (not stored in profiles) ───────────────
  const { data: userData, error: userError } =
    await serviceSupabase.auth.admin.getUserById(userId)

  if (userError || !userData?.user?.email) {
    console.error('[welcome-email] Could not fetch user email:', userError)
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const email = userData.user.email

  // ── 4. Send welcome email via Resend ──────────────────────────────────────
  const { error: sendError } = await getResend().emails.send({
    from:    'ReelHome <noreply@reelhome.ai>',
    to:      email,
    subject: `Velkommen til ReelHome, ${firstName}! 🎬`,
    html:    buildWelcomeEmail(firstName),
  })

  if (sendError) {
    console.error('[welcome-email] Resend error:', sendError)
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
  }

  console.log(`[welcome-email] Sent to ${email}`)
  return NextResponse.json({ ok: true })
}

// ── HTML template ────────────────────────────────────────────────────────────
function buildWelcomeEmail(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Velkommen til ReelHome</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #f5f5f5;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    a { text-decoration: none; }
    @media only screen and (max-width: 600px) {
      .email-card { padding: 32px 24px !important; }
      .btn        { display: block !important; width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background-color:#f5f5f5; padding:48px 16px;">
  <tr>
    <td align="center">

      <!-- Card -->
      <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:520px; background-color:#ffffff; border-radius:12px; border:1px solid #e5e5e5; padding:48px 48px 40px;">

        <!-- Header -->
        <tr>
          <td style="padding-bottom:36px; border-bottom:1px solid #f0f0f0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:28px; height:28px; background-color:#0f0f0f; border-radius:7px;
                    text-align:center; vertical-align:middle; font-family:'Inter',sans-serif;
                    font-size:14px; font-weight:700; color:#ffffff; line-height:28px;">R</td>
                <td style="padding-left:10px; vertical-align:middle;">
                  <span style="font-family:'Inter',sans-serif; font-size:16px; font-weight:700;
                    color:#0f0f0f; letter-spacing:-0.3px;">Reel<span style="color:#737373; font-weight:500;">Home</span></span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding-top:36px; padding-bottom:32px;">

            <!-- Heading -->
            <h1 style="font-family:'Inter',sans-serif; font-size:22px; font-weight:700;
              color:#0f0f0f; letter-spacing:-0.4px; line-height:1.3; margin:0 0 12px;">
              Velkommen til ReelHome, ${firstName}!
            </h1>

            <!-- Subtext -->
            <p style="font-family:'Inter',sans-serif; font-size:15px; color:#525252;
              line-height:1.65; margin:0 0 32px;">
              Du har <strong>14 dager gratis tilgang</strong> til alle funksjoner.
              Ingen kortinfo nødvendig.
            </p>

            <!-- Feature list -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"
              style="margin-bottom:32px; width:100%;">
              <tr>
                <td style="padding-bottom:14px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width:24px; height:24px; background-color:#eff6ff; border-radius:6px;
                          text-align:center; vertical-align:middle; font-size:13px; line-height:24px;">🎙</td>
                      <td style="padding-left:12px; vertical-align:middle;
                          font-family:'Inter',sans-serif; font-size:14px; color:#0f0f0f; font-weight:500;">
                        AI-avatar med din stemme
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width:24px; height:24px; background-color:#eff6ff; border-radius:6px;
                          text-align:center; vertical-align:middle; font-size:13px; line-height:24px;">⚡</td>
                      <td style="padding-left:12px; vertical-align:middle;
                          font-family:'Inter',sans-serif; font-size:14px; color:#0f0f0f; font-weight:500;">
                        Video klar på 5 minutter
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA button -->
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
              href="https://reelhome.ai/dashboard"
              style="height:48px;v-text-anchor:middle;width:220px;"
              arcsize="17%" strokecolor="#1d4ed8" fillcolor="#2563eb">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;">
                Gå til dashbordet
              </center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:#2563eb; border-radius:8px;">
                  <a href="https://reelhome.ai/dashboard" class="btn"
                    style="display:inline-block; padding:13px 28px;
                      font-family:'Inter',sans-serif; font-size:15px; font-weight:600;
                      color:#ffffff; text-decoration:none; letter-spacing:-0.1px;
                      border-radius:8px; line-height:1;">
                    Gå til dashbordet
                  </a>
                </td>
              </tr>
            </table>
            <!--<![endif]-->

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #f0f0f0; padding-top:28px;">
            <p style="font-family:'Inter',sans-serif; font-size:13px; color:#a3a3a3;
              line-height:1.6; margin:0;">
              Hvis du ikke opprettet en konto hos ReelHome, kan du ignorere denne e-posten.
              Ingen endringer vil bli gjort.
            </p>
          </td>
        </tr>

      </table>

      <!-- Sub-footer -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:520px; padding:20px 0 0;">
        <tr>
          <td align="center">
            <p style="font-family:'Inter',sans-serif; font-size:12px; color:#a3a3a3; margin:0;">
              © 2025 ReelHome &nbsp;·&nbsp;
              <a href="https://reelhome.ai" style="color:#a3a3a3; text-decoration:none;">reelhome.ai</a>
            </p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>`
}
