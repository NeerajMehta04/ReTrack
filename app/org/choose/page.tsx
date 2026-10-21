'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, ChevronRight, Plus } from 'lucide-react'
import Link from 'next/link'
import type { Organization } from '@/types'

interface OrgWithRole extends Organization {
  role: 'admin' | 'member'
}

export default function ChooseOrgPage() {
  const [orgs, setOrgs] = useState<OrgWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) { setLoading(false); return }

      const { data } = await supabase
        .from('org_members')
        .select('role, organizations(*)')
        .eq('email', user.email)

      const list: OrgWithRole[] = (data ?? [])
        .map((row: { role: 'admin' | 'member'; organizations: Organization | null }) =>
          row.organizations ? { ...row.organizations, role: row.role } : null
        )
        .filter(Boolean) as OrgWithRole[]

      setOrgs(list)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-primary-light flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo + title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/30">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Choose workspace</h1>
          <p className="text-sm text-gray-500 mt-1">You belong to multiple organisations</p>
        </div>

        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" style={{ border: '0.5px solid #F0D0DC' }} />
            ))
          ) : orgs.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm" style={{ border: '0.5px solid #F0D0DC' }}>
              <p className="text-sm text-gray-500 mb-3">No workspaces found</p>
              <Link href="/items" className="text-sm text-primary font-semibold hover:underline">
                Go to demo
              </Link>
            </div>
          ) : (
            orgs.map(org => (
              <Link
                key={org.id}
                href={`/org/${org.slug}/items`}
                className="flex items-center justify-between bg-white rounded-2xl px-4 py-4 shadow-sm hover:shadow-md transition-shadow"
                style={{ border: '0.5px solid #F0D0DC' }}
              >
                <div>
                  <p className="text-sm font-bold text-gray-900">{org.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{org.role}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
            ))
          )}

          {/* Demo + create links */}
          <div className="pt-3 flex flex-col gap-2">
            <Link
              href="/items"
              className="block text-center py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 transition-colors"
              style={{ border: '0.5px solid #E5E7EB' }}
            >
              Browse demo instead
            </Link>
            <Link
              href="/org/new"
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-primary hover:bg-primary-light transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create new workspace
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
