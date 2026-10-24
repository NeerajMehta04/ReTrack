export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user?.email) {
    const { data: memberships } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('email', user.email)

    if (!memberships || memberships.length === 0) {
      redirect('/org/setup')
    }
    redirect('/org/choose')
  }

  redirect('/items')
}
