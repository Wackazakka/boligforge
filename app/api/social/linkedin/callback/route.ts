import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reelhome.ai'
const SOCIAL_PAGE = `${BASE_URL}/dashboard/settings/social`

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')   // user ID
  const error = searchParams.get('error')

  if (error) return NextResponse.redirect(`${SOCIAL_PAGE}?error=${error}`)
  if (!code || !state) return NextResponse.redirect(`${SOCIAL_PAGE}?error=missing_params`)

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  process.env.LINKEDIN_REDIRECT_URI!,
        client_id:     process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }).toString(),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      console.error('[li/callback] No token:', tokenData)
      return NextResponse.redirect(`${SOCIAL_PAGE}?error=token_failed`)
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null

    // 2. Fetch profile via OpenID userinfo
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profile = await profileRes.json()
    const personId   = profile.sub
    const personName = profile.name ?? 'LinkedIn-konto'

    if (!personId) {
      console.error('[li/callback] No person ID:', profile)
      return NextResponse.redirect(`${SOCIAL_PAGE}?error=no_person_id`)
    }

    const supabase = getServiceClient()

    // 3. Save personal profile connection
    await supabase.from('social_connections').upsert(
      {
        user_id:           state,
        platform:          'linkedin',
        platform_user_id:  personId,
        page_id:           personId,
        page_name:         personName,
        access_token:      tokenData.access_token,
        user_access_token: tokenData.refresh_token ?? null,
        token_expires_at:  expiresAt,
      },
      { onConflict: 'user_id,platform,page_id' }
    )

    // 4. Optionally also save company pages (admin role)
    try {
      const orgsRes = await fetch(
        'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR' +
        '&projection=(elements*(organization~(id,localizedName)))',
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      )
      const orgsData = await orgsRes.json()
      for (const el of orgsData.elements ?? []) {
        const org = el['organization~']
        if (!org?.id) continue
        const orgId   = String(org.id)
        const orgName = org.localizedName ?? `LinkedIn-side ${orgId}`
        await supabase.from('social_connections').upsert(
          {
            user_id:           state,
            platform:          'linkedin',
            platform_user_id:  personId,
            page_id:           orgId,
            page_name:         `🏢 ${orgName}`,
            access_token:      tokenData.access_token,
            user_access_token: tokenData.refresh_token ?? null,
            token_expires_at:  expiresAt,
          },
          { onConflict: 'user_id,platform,page_id' }
        )
      }
    } catch (orgErr) {
      console.warn('[li/callback] Could not fetch org pages (non-fatal):', orgErr)
    }

    console.log(`[li/callback] ✅ LinkedIn connected for user ${state}: ${personName}`)
    return NextResponse.redirect(`${SOCIAL_PAGE}?connected=linkedin`)
  } catch (err) {
    console.error('[li/callback] Error:', err)
    return NextResponse.redirect(`${SOCIAL_PAGE}?error=server_error`)
  }
}
