import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'placeholder-key',
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
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
    return NextResponse.redirect(new URL('/login', request.url))
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
    const org = memberships[0].organizations as { slug: string } | null
    if (org?.slug) {
      return NextResponse.redirect(new URL(`/org/${org.slug}/items`, request.url))
    }
  }

  // Multiple orgs — show picker
  return NextResponse.redirect(new URL('/org/choose', request.url))
}
