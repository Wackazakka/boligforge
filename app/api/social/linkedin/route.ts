import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reelhome.ai'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.redirect(`${BASE_URL}/dashboard/settings/social?error=not_logged_in`)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri:  process.env.LINKEDIN_REDIRECT_URI!,
    state:         user.id,
    scope:         'openid profile email w_member_social',
  })

  return NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  )
}
