import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const errorCode = searchParams.get('error_code')
  const errorParam = searchParams.get('error')

  if (errorParam || errorCode) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', errorCode ?? errorParam ?? 'auth_error')
    return NextResponse.redirect(loginUrl)
  }

  if (!code) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'no_code')
    return NextResponse.redirect(loginUrl)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'placeholder-key',
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* ignored in server component */ }
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'otp_expired')
    return NextResponse.redirect(loginUrl)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.redirect(new URL('/items', request.url))
  }

  // Find orgs this email belongs to
  const { data: memberships } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(slug)')
    .eq('email', user.email)

  if (!memberships || memberships.length === 0) {
    return NextResponse.redirect(new URL('/items', request.url))
  }

  if (memberships.length === 1) {
    const raw = memberships[0].organizations as unknown
    const slug = Array.isArray(raw) ? (raw[0] as { slug: string })?.slug : (raw as { slug: string } | null)?.slug
    if (slug) {
      return NextResponse.redirect(new URL(`/org/${slug}/items`, request.url))
    }
  }

  // Multiple orgs — show picker
  return NextResponse.redirect(new URL('/org/choose', request.url))
}
