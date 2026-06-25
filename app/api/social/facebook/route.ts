import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reelhome.ai'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.redirect(`${BASE_URL}/dashboard/settings/social?error=not_logged_in`)

  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID!,
    redirect_uri:  process.env.META_FB_REDIRECT_URI!,
    scope:         'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_business_basic,instagram_content_publish',
    response_type: 'code',
    state:         user.id,   // carries user ID through OAuth round-trip
  })

  return NextResponse.redirect(`https://www.facebook.com/dialog/oauth?${params.toString()}`)
}
