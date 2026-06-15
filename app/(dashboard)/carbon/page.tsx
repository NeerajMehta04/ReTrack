'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Item } from '@/types'
import { Leaf } from 'lucide-react'

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

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3"
        style={{ borderBottom: '0.5px solid #F0D0DC' }}>
        <h1 className="text-lg font-bold text-gray-900">Carbon Impact</h1>
        <p className="text-xs text-gray-400 mt-0.5">CO₂ saved by upcycling</p>
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
