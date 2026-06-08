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
    // 1. Exchange code for short-lived user token
    const tokenRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        redirect_uri:  process.env.META_FB_REDIRECT_URI!,
        code,
      }).toString(),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      console.error('[fb/callback] No token:', tokenData)
      return NextResponse.redirect(`${SOCIAL_PAGE}?error=token_failed`)
    }

    // 2. Exchange for long-lived token (60 days)
    const llRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}` +
      `&fb_exchange_token=${tokenData.access_token}`
    )
    const llData = await llRes.json()
    const longToken = llData.access_token ?? tokenData.access_token
    const expiresAt = llData.expires_in
      ? new Date(Date.now() + llData.expires_in * 1000).toISOString()
      : null

    // 3. Fetch managed pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${longToken}`
    )
    const pagesData = await pagesRes.json()
    const pages: Array<{ id: string; name: string; access_token: string }> = pagesData.data ?? []

    if (pages.length === 0) {
      console.warn('[fb/callback] No pages found for user', state)
      return NextResponse.redirect(`${SOCIAL_PAGE}?error=no_pages`)
    }

    // 4. Save each page connection (service role bypasses RLS)
    const supabase = getServiceClient()
    let savedCount = 0
    for (const page of pages) {
      const { error: upsertError } = await supabase.from('social_connections').upsert(
        {
          user_id:           state,
          platform:          'facebook',
          page_id:           page.id,
          page_name:         page.name,
          access_token:      page.access_token,   // page-level token for posting
          user_access_token: longToken,            // long-lived user token
          token_expires_at:  expiresAt,
        },
        { onConflict: 'user_id,platform,page_id' }
      )
      if (upsertError) {
        console.error('[fb/callback] upsert failed for page', page.id, upsertError)
      } else {
        savedCount++
      }
    }

    if (savedCount === 0) {
      console.error('[fb/callback] No connections saved for user', state)
      return NextResponse.redirect(`${SOCIAL_PAGE}?error=save_failed`)
    }

    console.log(`[fb/callback] ✅ ${savedCount} page(s) connected for user ${state}`)
    return NextResponse.redirect(`${SOCIAL_PAGE}?connected=facebook`)
  } catch (err) {
    console.error('[fb/callback] Error:', err)
    return NextResponse.redirect(`${SOCIAL_PAGE}?error=server_error`)
  }
}
