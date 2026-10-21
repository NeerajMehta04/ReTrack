'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import type { Item } from '@/types'
import { Leaf, Download } from 'lucide-react'
import { downloadCSV } from '@/lib/utils'

export default function OrgCarbonPage() {
  const { org } = useOrg()
  const [tracked, setTracked] = useState<Item[]>([])
  const [untracked, setUntracked] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('items')
        .select('*, categories(icon, color, name)')
        .eq('org_id', org.id)
        .is('deleted_at', null)
        .order('carbon_kg_total', { ascending: false })

      const all = data ?? []
      setTracked(all.filter(i => i.carbon_kg_per_item != null))
      setUntracked(all.filter(i => i.carbon_kg_per_item == null))
      setLoading(false)
    }
    load()
  }, [org.id])

  const totalCarbon = tracked.reduce((sum, i) => sum + (i.carbon_kg_total ?? 0), 0)

  const equivalents = totalCarbon > 0 ? [
    { emoji: '✈️', text: `${(totalCarbon / 120).toFixed(1)}× Oslo–London` },
    { emoji: '🚗', text: `${Math.round(totalCarbon / 0.175).toLocaleString()} km not driven` },
    { emoji: '🌳', text: `${Math.round(totalCarbon / 20)} trees planted` },
    { emoji: '📱', text: `${Math.round(totalCarbon / 0.005).toLocaleString()} phone charges` },
  ] : []

  function handleExport() {
    type Row = Record<string, string | number | undefined>
    const rows: Row[] = [
      ...tracked.map(item => ({ item: item.name, category: item.categories?.name ?? 'Uncategorised', stock: item.stock, carbon_kg_per_item: item.carbon_kg_per_item ?? undefined, carbon_kg_total: item.carbon_kg_total ?? undefined, summary: item.carbon_summary ?? '', status: 'assessed' })),
      ...untracked.map(item => ({ item: item.name, category: item.categories?.name ?? 'Uncategorised', stock: item.stock, carbon_kg_per_item: undefined, carbon_kg_total: undefined, summary: '', status: 'not assessed' })),
    ]
    downloadCSV(rows, `carbon_${org.slug}_${new Date().toISOString().split('T')[0]}.csv`)
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
          <h1 className="text-lg font-bold text-gray-900">Carbon Impact</h1>
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Carbon Impact</h1>
            <p className="text-[10px] text-gray-400">{org.name}</p>
          </div>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary rounded-lg hover:bg-primary-light transition-colors" style={{ border: '0.5px solid #D4537E' }}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Total hero card */}
        <div className="bg-green-50 rounded-2xl p-5" style={{ border: '0.5px solid #BBF7D0' }}>
          <div className="flex items-center gap-2 mb-2">
            <Leaf className="w-5 h-5 text-green-600" />
            <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Total CO₂ Saved</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-green-600">{totalCarbon.toFixed(1)}</span>
            <span className="text-sm text-green-500 font-medium">kg CO₂e</span>
          </div>
          <p className="text-xs text-green-500 mt-1">by upcycling instead of buying new</p>

          {equivalents.length > 0 && (
            <div className="mt-4 pt-4 grid grid-cols-2 gap-2" style={{ borderTop: '0.5px solid #BBF7D0' }}>
              {equivalents.map(eq => (
                <div key={eq.text} className="flex items-center gap-2">
                  <span className="text-lg">{eq.emoji}</span>
                  <span className="text-xs text-green-700 font-medium leading-tight">{eq.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tracked items */}
        {tracked.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tracked Items ({tracked.length})</h2>
            <div className="space-y-2">
              {tracked.map(item => (
                <button key={item.id} onClick={() => router.push(`/org/${org.slug ?? ''}/items/${item.id}`)} className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors text-left" style={{ border: '0.5px solid #F0D0DC' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{item.categories?.icon ?? '📦'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{item.carbon_kg_per_item} kg/item · {item.stock} in stock</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-bold text-green-600">{item.carbon_kg_total} kg</p>
                    <p className="text-[10px] text-green-400">total saved</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Untracked items */}
        {untracked.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Not Yet Assessed ({untracked.length})</h2>
            <div className="space-y-2">
              {untracked.map(item => (
                <button key={item.id} onClick={() => router.push(`/org/${org.slug ?? ''}/items/${item.id}`)} className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors text-left" style={{ border: '0.5px solid #E5E7EB' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{item.categories?.icon ?? '📦'}</span>
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 ml-3">Add photo to estimate →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tracked.length === 0 && untracked.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Leaf className="w-12 h-12 mb-3 opacity-25" />
            <p className="text-sm font-medium">No items yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
