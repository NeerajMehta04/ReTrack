'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import type { GroupStats } from '@/types'
import { Users } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/Skeleton'

export default function OrgGroupsPage() {
  const { org } = useOrg()
  const [groups, setGroups] = useState<GroupStats[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchGroups() {
      const [groupsRes, logsRes] = await Promise.all([
        supabase.from('groups').select('*').eq('org_id', org.id).order('name'),
        supabase.from('logs').select('group_id, direction, amount').eq('org_id', org.id),
      ])

      const rawGroups = groupsRes.data ?? []
      const logs = logsRes.data ?? []

      const withStats: GroupStats[] = rawGroups.map(group => {
        const groupLogs = logs.filter(l => l.group_id === group.id)
        return {
          ...group,
          items_taken: groupLogs.filter(l => l.direction === 'out').reduce((sum, l) => sum + l.amount, 0),
          items_given: groupLogs.filter(l => l.direction === 'in').reduce((sum, l) => sum + l.amount, 0),
          total_movements: groupLogs.length,
        }
      })

      setGroups(withStats)
      setLoading(false)
    }
    fetchGroups()
  }, [org.id])

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
        <h1 className="text-lg font-bold text-gray-900">Groups</h1>
        <p className="text-xs text-gray-400 mt-0.5">{org.name}</p>
      </div>

      <div className="p-4 space-y-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          : groups.length === 0
          ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Users className="w-12 h-12 mb-3 opacity-25" />
              <p className="text-sm font-medium">No groups yet</p>
            </div>
          )
          : groups.map(group => (
            <div key={group.id} className="bg-white rounded-2xl p-4" style={{ border: '0.5px solid #F0D0DC' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{group.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <Users className="inline w-3 h-3 mr-0.5" />
                    {group.member_count} members
                  </p>
                </div>
                <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                  {group.total_movements} movements
                </span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-red-500">{group.items_taken}</p>
                  <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mt-0.5">Taken out</p>
                </div>
                <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-green-600">{group.items_given}</p>
                  <p className="text-[10px] font-semibold text-green-500 uppercase tracking-wide mt-0.5">Brought in</p>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
