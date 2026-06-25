import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getServiceClient()
  const { data: pages } = await supabase
    .from('social_connections')
    .select('page_id, page_name, access_token')
    .eq('user_id', user.id)
    .eq('platform', 'facebook')

  if (!pages?.length) return NextResponse.json({ error: 'No FB pages found' })

  const results = await Promise.all(pages.map(async page => {
    const url = `https://graph.facebook.com/v21.0/${page.page_id}?fields=instagram_business_account{id,name,username}&access_token=${page.access_token}`
    const res = await fetch(url)
    const data = await res.json()
    return { page_name: page.page_name, page_id: page.page_id, response: data }
  }))

  return NextResponse.json(results)
}
