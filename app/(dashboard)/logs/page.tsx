'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Item, Group, Log } from '@/types'
import {
  Plus, Download, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, ClipboardList, X,
} from 'lucide-react'
import { formatDate, downloadCSV } from '@/lib/utils'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import LogModal from '@/components/logs/LogModal'

type SortField = 'created_at' | 'amount'
type SortDir = 'asc' | 'desc'

function SortBtn({
  field,
  active,
  dir,
  onClick,
  children,
}: {
  field: SortField
  active: boolean
  dir: SortDir
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-0.5">
      {children}
      {active ? (
        dir === 'asc' ? (
          <ChevronUp className="w-3 h-3 text-primary" />
        ) : (
          <ChevronDown className="w-3 h-3 text-primary" />
        )
      ) : (
        <ChevronDown className="w-3 h-3 text-gray-300" />
      )}
    </button>
  )
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<Log | null>(null)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const supabase = createClient()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('logs')
      .select('*, items(*, categories(*)), groups(*)')
      .order(sortField, { ascending: sortDir === 'asc' })

    if (filterFrom) query = query.gte('created_at', filterFrom + 'T00:00:00')
    if (filterTo)   query = query.lte('created_at', filterTo   + 'T23:59:59')
    if (filterGroup) query = query.eq('group_id', filterGroup)

    const { data } = await query
    setLogs(data ?? [])
    setLoading(false)
  }, [sortField, sortDir, filterFrom, filterTo, filterGroup])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    supabase.from('items').select('*').order('name').then(({ data }) => data && setItems(data))
    supabase.from('groups').select('*').order('name').then(({ data }) => data && setGroups(data))
  }, [])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('desc') }
  }

  function handleExport() {
    downloadCSV(
      logs.map(log => ({
        date: formatDate(log.created_at),
        item: log.items?.name ?? log.item_id,
        direction: log.direction,
        amount: log.amount,
        condition: log.condition ?? '',
        group: log.groups?.name ?? '',
        comment: log.comment ?? '',
      })),
      `logs_${new Date().toISOString().split('T')[0]}.csv`
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div
        className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3"
        style={{ borderBottom: '0.5px solid #F0D0DC' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">Movement Logs</h1>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary rounded-lg hover:bg-primary-light transition-colors"
            style={{ border: '0.5px solid #D4537E' }}
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5">
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
            style={{ border: '0.5px solid #E5E7EB' }}
            title="From date"
          />
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white"
            style={{ border: '0.5px solid #E5E7EB' }}
            title="To date"
          />
          <select
            value={filterGroup}
            onChange={e => setFilterGroup(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-primary bg-white appearance-none"
            style={{ border: '0.5px solid #E5E7EB' }}
          >
            <option value="">All groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full min-w-[360px]">
          <thead>
            <tr className="bg-gray-50" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Item
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <SortBtn field="created_at" active={sortField === 'created_at'} dir={sortDir} onClick={() => toggleSort('created_at')}>
                  Date
                </SortBtn>
              </th>
              <th className="text-right px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <SortBtn field="amount" active={sortField === 'amount'} dir={sortDir} onClick={() => toggleSort('amount')}>
                  Qty
                </SortBtn>
              </th>
              <th className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden sm:table-cell">
                Comment
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 7 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />)
              : logs.length === 0
              ? (
                <tr>
                  <td colSpan={4}>
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <ClipboardList className="w-12 h-12 mb-3 opacity-25" />
                      <p className="text-sm font-medium">No logs found</p>
                    </div>
                  </td>
                </tr>
              )
              : logs.map(log => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors"
                  style={{ borderBottom: '0.5px solid #F5F5F5' }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-primary-light flex items-center justify-center flex-shrink-0">
                        {log.items?.image_url ? (
                          <Image
                            src={log.items.image_url}
                            alt={log.items.name ?? ''}
                            width={32}
                            height={32}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <span className="text-sm" aria-hidden>
                            {log.items?.categories?.icon ?? '📦'}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-900 truncate max-w-[90px]">
                        {log.items?.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`inline-flex items-center gap-0.5 text-sm font-bold ${
                        log.direction === 'in' ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {log.direction === 'in'
                        ? <TrendingUp className="w-3.5 h-3.5" />
                        : <TrendingDown className="w-3.5 h-3.5" />}
                      {log.direction === 'in' ? '+' : '−'}{log.amount}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-400 hidden sm:table-cell max-w-[120px] truncate">
                    {log.comment ?? '—'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* FAB */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary-dark active:scale-95 transition-all z-20"
        aria-label="Log movement"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

      {/* Log detail sheet */}
      {selectedLog && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30"
            onClick={() => setSelectedLog(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl p-5 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Log Detail</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              {[
                ['Item', selectedLog.items?.name],
                ['Direction', selectedLog.direction === 'in' ? '↑ In (received)' : '↓ Out (given away)'],
                ['Amount', String(selectedLog.amount)],
                ['Group', selectedLog.groups?.name],
                ['Condition', selectedLog.condition],
                ['Comment', selectedLog.comment],
                ['Date', formatDate(selectedLog.created_at)],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-gray-400 flex-shrink-0">{label}</dt>
                    <dd
                      className={`font-semibold text-right ${
                        label === 'Direction'
                          ? selectedLog.direction === 'in'
                            ? 'text-green-600'
                            : 'text-red-500'
                          : 'text-gray-900'
                      }`}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        </>
      )}

      {/* New log modal */}
      <LogModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        items={items}
        groups={groups}
        onSaved={fetchLogs}
      />
    </div>
  )
}
