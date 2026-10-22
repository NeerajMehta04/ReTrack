export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrgProvider } from '@/lib/org-context'
import BottomNav from '@/components/BottomNav'
import Toaster from '@/components/Toaster'
import type { Organization } from '@/types'

interface Props {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function OrgLayout({ children, params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw new Error(`Auth error: ${authErr.message}`)
  if (!user) redirect('/login')

  // Load the org
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (orgErr && orgErr.code !== 'PGRST116') {
    throw new Error(`Failed to load workspace: ${orgErr.message}`)
  }
  if (!org) redirect('/items')

  // Check the user is a member
  const { data: membership, error: memberErr } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', org.id)
    .eq('email', user.email!)
    .single()

  if (memberErr && memberErr.code !== 'PGRST116') {
    throw new Error(`Failed to verify membership: ${memberErr.message}`)
  }
  if (!membership) redirect('/items')

  const isAdmin = membership.role === 'admin' || org.owner_id === user.id
  const basePath = `/org/${slug}`

  return (
    <OrgProvider org={org as Organization} isAdmin={isAdmin}>
      <div className="relative min-h-screen bg-white max-w-md mx-auto" style={{ boxShadow: '0 0 0 0.5px #F0D0DC' }}>
        <main className="pb-16 min-h-screen">{children}</main>
        <BottomNav basePath={basePath} showSettings={true} />
        <Toaster />
      </div>
    </OrgProvider>
  )
}
