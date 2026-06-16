'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Item } from '@/types'
import { Leaf, Download } from 'lucide-react'
import { downloadCSV } from '@/lib/utils'

export default function CarbonPage() {
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
        .is('deleted_at', null)
        .order('carbon_kg_total', { ascending: false })

      const all = data ?? []
      setTracked(all.filter(i => i.carbon_kg_per_item != null))
      setUntracked(all.filter(i => i.carbon_kg_per_item == null))
      setLoading(false)
    }
    load()
  }, [])

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
      ...tracked.map(item => ({
        item: item.name,
        category: item.categories?.name ?? 'Uncategorised',
        stock: item.stock,
        carbon_kg_per_item: item.carbon_kg_per_item ?? undefined,
        carbon_kg_total: item.carbon_kg_total ?? undefined,
        summary: item.carbon_summary ?? '',
        status: 'assessed',
      })),
      ...untracked.map(item => ({
        item: item.name,
        category: item.categories?.name ?? 'Uncategorised',
        stock: item.stock,
        carbon_kg_per_item: undefined,
        carbon_kg_total: undefined,
        summary: '',
        status: 'not assessed',
      })),
    ]

    rows.push({
      item: 'TOTAL',
      category: '',
      stock: tracked.reduce((s, i) => s + i.stock, 0),
      carbon_kg_per_item: undefined,
      carbon_kg_total: totalCarbon,
      summary: `${tracked.length} items assessed, ${untracked.length} not yet assessed`,
      status: '',
    })

    if (totalCarbon > 0) {
      rows.push({ item: '', category: '', stock: undefined, carbon_kg_per_item: undefined, carbon_kg_total: undefined, summary: '', status: '' })
      rows.push({ item: 'CO2 EQUIVALENTS', category: '', stock: undefined, carbon_kg_per_item: undefined, carbon_kg_total: undefined, summary: '', status: '' })
      rows.push({ item: 'Oslo–London trips', category: '', stock: undefined, carbon_kg_per_item: undefined, carbon_kg_total: (totalCarbon / 120).toFixed(1), summary: 'times', status: '' })
      rows.push({ item: 'Driving distance', category: '', stock: undefined, carbon_kg_per_item: undefined, carbon_kg_total: Math.round(totalCarbon / 0.175), summary: 'km not driven', status: '' })
      rows.push({ item: 'Trees planted', category: '', stock: undefined, carbon_kg_per_item: undefined, carbon_kg_total: Math.round(totalCarbon / 20), summary: 'annual CO2 absorption', status: '' })
      rows.push({ item: 'Phone charges', category: '', stock: undefined, carbon_kg_per_item: undefined, carbon_kg_total: Math.round(totalCarbon / 0.005), summary: 'full charges', status: '' })
    }

    downloadCSV(rows, `carbon_impact_${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3"
        style={{ borderBottom: '0.5px solid #F0D0DC' }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Carbon Impact</h1>
            <p className="text-xs text-gray-400 mt-0.5">CO₂ saved by upcycling</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-600 rounded-lg hover:bg-green-50 transition-colors"
            style={{ border: '0.5px solid #86EFAC' }}
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-300">
            <Leaf className="w-10 h-10" />
          </div>
        ) : (
          <>
            {/* Hero total */}
            <div className="bg-green-50 rounded-2xl p-6 text-center"
              style={{ border: '0.5px solid #BBF7D0' }}>
              <Leaf className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-5xl font-black text-green-600">
                {totalCarbon.toFixed(1)}
              </p>
              <p className="text-sm font-semibold text-green-500 mt-1">kg CO₂ saved in total</p>
              <p className="text-xs text-green-400 mt-1">
                Across {tracked.length} item{tracked.length !== 1 ? 's' : ''} tracked
              </p>
              {equivalents.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4"
                  style={{ borderTop: '0.5px solid #BBF7D0' }}>
                  {equivalents.map(eq => (
                    <div key={eq.emoji}
                      className="bg-white/60 rounded-xl px-3 py-2 flex items-center gap-2">
                      <span className="text-base flex-shrink-0">{eq.emoji}</span>
                      <span className="text-xs text-green-700 font-medium leading-tight">
                        {eq.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Per-item breakdown */}
            {tracked.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Breakdown
                </h2>
                <div className="space-y-2">
                  {tracked.map(item => (
                    <button
                      key={item.id}
                      onClick={() => router.push(`/items/${item.id}`)}
                      className="w-full flex items-center gap-3 bg-white rounded-xl p-3 text-left hover:bg-gray-50 transition-colors"
                      style={{ border: '0.5px solid #F0D0DC' }}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ backgroundColor: (item.categories?.color ?? '#D4537E') + '22' }}>
                        {item.categories?.icon ?? '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">
                          {item.stock} in stock · {item.carbon_kg_per_item} kg/item
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-green-600">{item.carbon_kg_total} kg</p>
                        <p className="text-[10px] text-green-400">saved</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Not yet assessed */}
            {untracked.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Not yet assessed ({untracked.length})
                </h2>
                <div className="bg-gray-50 rounded-xl p-3"
                  style={{ border: '0.5px solid #E5E7EB' }}>
                  <p className="text-xs text-gray-400 mb-2">
                    Upload a photo to each item to estimate its carbon savings
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {untracked.map(item => (
                      <button
                        key={item.id}
                        onClick={() => router.push(`/items/${item.id}`)}
                        className="text-xs px-2.5 py-1 bg-white rounded-full text-gray-600 hover:text-primary transition-colors"
                        style={{ border: '0.5px solid #E5E7EB' }}
                      >
                        {item.categories?.icon ?? '📦'} {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tracked.length === 0 && untracked.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <Leaf className="w-10 h-10 mx-auto mb-3 opacity-25" />
                <p className="text-sm font-medium">No items yet</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
