export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import type { Item, Category } from '@/types'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function PublicOrgPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch org — only succeeds if is_public = true (RLS enforces this)
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, description, location, slug')
    .eq('slug', slug)
    .eq('is_public', true)
    .single()

  if (!org) notFound()

  const { data: rawItems } = await supabase
    .from('items')
    .select('*, categories(*)')
    .eq('org_id', org.id)
    .is('deleted_at', null)
    .order('name')

  const items = (rawItems ?? []) as (Item & { categories: Category | null })[]

  // Group by category
  const grouped = new Map<string, { category: Category | null; items: typeof items }>()
  for (const item of items) {
    const key = item.category_id ?? '__none__'
    if (!grouped.has(key)) grouped.set(key, { category: item.categories ?? null, items: [] })
    grouped.get(key)!.items.push(item)
  }
  const groups = Array.from(grouped.values()).sort((a, b) => {
    if (!a.category) return 1
    if (!b.category) return -1
    return a.category.name.localeCompare(b.category.name)
  })

  const inStockCount = items.filter(i => i.stock > 0).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-5" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📦</span>
            <h1 className="text-xl font-black text-gray-900">{org.name}</h1>
          </div>
          {org.description && (
            <p className="text-sm text-gray-600 mt-1">{org.description}</p>
          )}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {org.location && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                📍 {org.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              {inStockCount} of {items.length} items available
            </span>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="max-w-md mx-auto px-4 py-5 space-y-6">
        {items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm font-medium">No items listed yet</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.category?.id ?? '__none__'}>
              {group.category && (
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: group.category.color }}
                  >
                    {group.category.icon} {group.category.name}
                  </span>
                </div>
              )}
              <div className="space-y-2">
                {group.items.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-3 bg-white rounded-xl ${item.stock === 0 ? 'opacity-50' : ''}`}
                    style={{ border: '0.5px solid #F0D0DC' }}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-pink-50 flex-shrink-0 flex items-center justify-center">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          width={48}
                          height={48}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <span className="text-xl">{item.categories?.icon ?? '📦'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {item.stock > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          ✓ {item.stock} available
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-400">
                          Out of stock
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto px-4 pb-10 text-center">
        <p className="text-[11px] text-gray-400">
          Powered by{' '}
          <span className="font-semibold text-gray-500">ReTrack</span>
          {' '}· free inventory management for community orgs
        </p>
      </div>
    </div>
  )
}
