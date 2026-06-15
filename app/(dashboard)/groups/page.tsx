'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { GroupStats } from '@/types'
import { Users } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/Skeleton'

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupStats[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchGroups() {
      const [groupsRes, logsRes] = await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase.from('logs').select('group_id, direction, amount'),
      ])

      const rawGroups = groupsRes.data ?? []
      const logs = logsRes.data ?? []

      const withStats: GroupStats[] = rawGroups.map(group => {
        const groupLogs = logs.filter(l => l.group_id === group.id)
        return {
          ...group,
          items_taken: groupLogs
            .filter(l => l.direction === 'out')
            .reduce((sum, l) => sum + l.amount, 0),
          items_given: groupLogs
            .filter(l => l.direction === 'in')
            .reduce((sum, l) => sum + l.amount, 0),
          total_movements: groupLogs.length,
        }
      })

      setGroups(withStats)
      setLoading(false)
    }
    fetchGroups()
  }, [])

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div
        className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3"
        style={{ borderBottom: '0.5px solid #F0D0DC' }}
      >
        <h1 className="text-lg font-bold text-gray-900">Groups</h1>
        <p className="text-xs text-gray-400 mt-0.5">Student organisations & departments</p>
      </div>

      <div className="p-4 space-y-3 pb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users className="w-12 h-12 mb-3 opacity-25" />
            <p className="text-sm font-medium">No groups yet</p>
          </div>
        ) : (
          groups.map(group => (
            <div
              key={group.id}
              className="bg-white rounded-2xl p-4"
              style={{ border: '0.5px solid #F0D0DC' }}
            >
              {/* Group header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{group.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className="text-xs font-semibold bg-primary-light text-primary px-2.5 py-1 rounded-full">
                  {group.total_movements} log{group.total_movements !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 bg-red-50">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1">
                    Taken out
                  </p>
                  <p className="text-3xl font-black text-red-500 leading-none">
                    {group.items_taken}
                  </p>
                  <p className="text-[10px] text-red-300 mt-0.5">items</p>
                </div>
                <div className="rounded-xl p-3 bg-green-50">
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-wide mb-1">
                    Brought in
                  </p>
                  <p className="text-3xl font-black text-green-600 leading-none">
                    {group.items_given}
                  </p>
                  <p className="text-[10px] text-green-400 mt-0.5">items</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
