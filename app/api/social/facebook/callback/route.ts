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

    // 4. Save each page connection + linked Instagram Business Account
    const supabase = getServiceClient()
    let savedCount = 0
    let igCount = 0
    for (const page of pages) {
      // Fetch Instagram Business Account linked to this page (if any)
      let igUserId: string | null = null
      let igName: string | null = null
      try {
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,name,username}&access_token=${page.access_token}`
        )
        const igData = await igRes.json()
        if (igData.instagram_business_account?.id) {
          igUserId = igData.instagram_business_account.id
          igName = igData.instagram_business_account.username ?? igData.instagram_business_account.name ?? null
        }
      } catch (e) {
        console.warn('[fb/callback] IG lookup failed for page', page.id, e)
      }

      const { error: upsertError } = await supabase.from('social_connections').upsert(
        {
          user_id:            state,
          platform:           'facebook',
          page_id:            page.id,
          page_name:          page.name,
          access_token:       page.access_token,
          user_access_token:  longToken,
          token_expires_at:   expiresAt,
          instagram_user_id:  igUserId,
        },
        { onConflict: 'user_id,platform,page_id' }
      )
      if (upsertError) {
        console.error('[fb/callback] upsert failed for page', page.id, upsertError)
      } else {
        savedCount++
      }

      // Save Instagram as a separate connection row so users can select it independently
      if (igUserId) {
        const { error: igErr } = await supabase.from('social_connections').upsert(
          {
            user_id:           state,
            platform:          'instagram',
            page_id:           igUserId,
            page_name:         igName ?? page.name,
            access_token:      page.access_token,  // IG API uses the FB page token
            user_access_token: longToken,
            token_expires_at:  expiresAt,
            instagram_user_id: igUserId,
          },
          { onConflict: 'user_id,platform,page_id' }
        )
        if (igErr) {
          console.error('[fb/callback] IG upsert failed', igUserId, igErr)
        } else {
          igCount++
        }
      }
    }

    if (savedCount === 0) {
      console.error('[fb/callback] No connections saved for user', state)
      return NextResponse.redirect(`${SOCIAL_PAGE}?error=save_failed`)
    }

    console.log(`[fb/callback] ✅ ${savedCount} FB page(s), ${igCount} IG account(s) connected for user ${state}`)
    return NextResponse.redirect(`${SOCIAL_PAGE}?connected=facebook`)
  } catch (err) {
    console.error('[fb/callback] Error:', err)
    return NextResponse.redirect(`${SOCIAL_PAGE}?error=server_error`)
  }
}
