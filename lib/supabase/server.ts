import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { unstable_noStore } from 'next/cache'

// Supabase URL er en offentlig verdi — hardkodet som fallback for Netlify-funksjoner
// der NEXT_PUBLIC_* env vars ikke alltid er tilgjengelige
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jvnavubholyvihvytqkn.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function createSupabaseServerClient() {
  unstable_noStore()
  const cookieStore = await cookies()
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export async function getUser() {
  // Prøv SSR-klient først
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    // Fallback: les token direkte fra cookie og verifiser med service role
    try {
      const cookieStore = await cookies()
      const allCookies = cookieStore.getAll()

      // Supabase lagrer auth-token i cookies som starter med 'sb-'
      const authCookies = allCookies
        .filter(c => /^sb-.+-auth-token/.test(c.name))
        .sort((a, b) => a.name.localeCompare(b.name))

      if (!authCookies.length) return null

      // Token kan være delt i chunks — sett dem sammen
      const rawValue = authCookies.map(c => c.value).join('')
      const tokenData = JSON.parse(rawValue)
      const accessToken = Array.isArray(tokenData) ? tokenData[0] : tokenData?.access_token

      if (!accessToken) return null

      const serviceClient = createClient(
        SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { data: { user } } = await serviceClient.auth.getUser(accessToken)
      return user
    } catch {
      return null
    }
  }
}
