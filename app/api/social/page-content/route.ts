import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

// Leser sidens identitet og de siste innleggene rett fra Graph API.
//
// Dette er den ENESTE stedet ReelHome faktisk bruker pages_read_engagement.
// Metas reviewer avslo tillatelsen 1.9.2026 fordi de ikke fikk se appen hente
// og vise sideinnhold noe sted — publiseringshistorikken vår kommer fra vår
// egen tabell, ikke fra Facebook. Megleren har uansett nytte av det: det er
// slik man ser at riktig side er koblet til, og hva som faktisk ligger ute.
//
// Merk: leses live ved forespørsel, ingenting lagres. Tilkoblingen slås opp
// med user_id i filteret, slik at ingen kan lese en side de ikke eier.

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type GraphPost = {
  id: string
  message?: string
  created_time?: string
  full_picture?: string
  permalink_url?: string
}

export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connectionId = request.nextUrl.searchParams.get('connectionId')
  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId mangler' }, { status: 400 })
  }

  const supabase = getServiceClient()
  const { data: conn, error } = await supabase
    .from('social_connections')
    .select('id, platform, page_id, page_name, access_token')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!conn) return NextResponse.json({ error: 'Fant ikke tilkoblingen' }, { status: 404 })
  if (conn.platform !== 'facebook') {
    return NextResponse.json({ error: 'Kun Facebook-sider stottes her' }, { status: 400 })
  }

  const token = encodeURIComponent(conn.access_token)

  try {
    // Sidens identitet — navn, profilbilde og folgertall.
    const pageRes = await fetch(
      `https://graph.facebook.com/v21.0/${conn.page_id}` +
        `?fields=id,name,picture.width(120).height(120){url},followers_count,fan_count` +
        `&access_token=${token}`
    )
    const pageData = await pageRes.json()
    if (pageData.error) {
      console.error('[social/page-content] Page lookup failed:', pageData.error)
      return NextResponse.json(
        { error: pageData.error.message ?? 'Kunne ikke hente siden' },
        { status: 502 }
      )
    }

    // Innholdet som ligger ute paa siden.
    const postsRes = await fetch(
      `https://graph.facebook.com/v21.0/${conn.page_id}/posts` +
        `?fields=id,message,created_time,full_picture,permalink_url&limit=6` +
        `&access_token=${token}`
    )
    const postsData = await postsRes.json()
    if (postsData.error) {
      console.error('[social/page-content] Posts lookup failed:', postsData.error)
      return NextResponse.json(
        { error: postsData.error.message ?? 'Kunne ikke hente innleggene' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      page: {
        id: pageData.id,
        name: pageData.name,
        pictureUrl: pageData.picture?.data?.url ?? null,
        followers: pageData.followers_count ?? pageData.fan_count ?? null,
      },
      posts: (postsData.data ?? []).map((p: GraphPost) => ({
        id: p.id,
        message: p.message ?? null,
        createdTime: p.created_time ?? null,
        imageUrl: p.full_picture ?? null,
        permalink: p.permalink_url ?? null,
      })),
    })
  } catch (err) {
    console.error('[social/page-content] Exception:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
