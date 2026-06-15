'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Item, Category } from '@/types'
import { Search, X, ShoppingCart, ChevronRight, Package, Plus } from 'lucide-react'
import { ItemSkeleton } from '@/components/ui/Skeleton'
import ItemModal from '@/components/items/ItemModal'

function ItemsList() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const categoryFilter = searchParams.get('category')

  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => data && setCategories(data))
  }, [])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('items')
      .select('*, categories(*)')
      .is('deleted_at', null)
      .order('name')

    if (categoryFilter) query = query.eq('category_id', categoryFilter)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data } = await query
    setItems(data ?? [])
    setLoading(false)
  }, [categoryFilter, search])

  useEffect(() => { fetchItems() }, [fetchItems])

  const activeCategory = categories.find(c => c.id === categoryFilter)

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky header */}
      <div
        className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3"
        style={{ borderBottom: '0.5px solid #F0D0DC' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">Inventory</h1>
          <button
            onClick={() => setModalOpen(true)}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm shadow-primary/20 hover:bg-primary-dark active:scale-95 transition-all"
            aria-label="Add item"
          >
            <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            style={{ border: '0.5px solid #E5E7EB' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {activeCategory && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: activeCategory.color }}
            >
              {activeCategory.icon} {activeCategory.name}
              <button
                onClick={() => router.push('/items')}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Item list */}
      <div className="flex-1">
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => <ItemSkeleton key={i} />)
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Package className="w-12 h-12 mb-3 opacity-25" />
            <p className="text-sm font-medium">No items found</p>
            {(search || categoryFilter) && (
              <button
                onClick={() => { setSearch(''); router.push('/items') }}
                className="mt-2 text-xs text-primary underline"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add first item
            </button>
          </div>
        ) : (
          items.map(item => (
            <Link
              key={item.id}
              href={`/items/${item.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              style={{ borderBottom: '0.5px solid #F5F5F5' }}
            >
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-primary-light flex-shrink-0 flex items-center justify-center">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-2xl" aria-hidden>
                    {item.categories?.icon ?? '📦'}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {item.description ?? item.categories?.name ?? '—'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-bold text-gray-800 min-w-[24px] text-right">
                  {item.stock}
                </span>
                <ShoppingCart className="w-4 h-4 text-gray-300" />
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Add Item modal */}
      <ItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categories}
        onSaved={() => { fetchItems() }}
      />
    </div>
  )
}

export default function ItemsPage() {
  return (
    <Suspense fallback={Array.from({ length: 7 }).map((_, i) => <ItemSkeleton key={i} />)}>
      <ItemsList />
    </Suspense>
  )
}
