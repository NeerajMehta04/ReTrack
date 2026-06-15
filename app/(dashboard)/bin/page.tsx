'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trash2, RotateCcw, Package, PackageOpen } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

type DeletedItem = { id: string; name: string; deleted_at: string }
type DeletedCategory = { id: string; name: string; icon: string; color: string; deleted_at: string }
type PurgeTarget = { kind: 'item'; record: DeletedItem } | { kind: 'category'; record: DeletedCategory }

export default function BinPage() {
  const [tab, setTab] = useState<'items' | 'categories'>('items')
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([])
  const [deletedCats, setDeletedCats] = useState<DeletedCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null)
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [working, setWorking] = useState(false)
  const supabase = createClient()

  const fetchBin = useCallback(async () => {
    setLoading(true)
    const [itemsRes, catsRes] = await Promise.all([
      supabase
        .from('items')
        .select('id, name, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      supabase
        .from('categories')
        .select('id, name, icon, color, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
    ])
    setDeletedItems((itemsRes.data as DeletedItem[]) ?? [])
    setDeletedCats((catsRes.data as DeletedCategory[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchBin() }, [fetchBin])

  useEffect(() => {
    const anyOpen = !!purgeTarget || confirmEmpty
    document.body.style.overflow = anyOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [purgeTarget, confirmEmpty])

  // ── Restore ───────────────────────────────────────────────────
  async function restoreItem(item: DeletedItem) {
    const { error } = await supabase.from('items').update({ deleted_at: null }).eq('id', item.id)
    if (error) { toast.error('Restore failed'); return }
    toast.success(`"${item.name}" restored`)
    fetchBin()
  }

  async function restoreCategory(cat: DeletedCategory) {
    await supabase.from('categories').update({ deleted_at: null }).eq('id', cat.id)
    // Restore items that belong to this category and are also in the bin
    await supabase.from('items').update({ deleted_at: null }).eq('category_id', cat.id).not('deleted_at', 'is', null)
    toast.success(`"${cat.name}" restored`)
    fetchBin()
  }

  // ── Hard delete (purge) ───────────────────────────────────────
  async function purgeItem(item: DeletedItem) {
    setWorking(true)
    try {
      await supabase.from('logs').delete().eq('item_id', item.id)
      await supabase.from('items').delete().eq('id', item.id)
      toast.success(`"${item.name}" permanently deleted`)
      setPurgeTarget(null)
      fetchBin()
    } catch {
      toast.error('Failed to delete')
    } finally {
      setWorking(false)
    }
  }

  async function purgeCategory(cat: DeletedCategory) {
    setWorking(true)
    try {
      // Purge items in this category that are also in the bin
      const { data: binItems } = await supabase
        .from('items')
        .select('id')
        .eq('category_id', cat.id)
        .not('deleted_at', 'is', null)
      for (const bi of binItems ?? []) {
        await supabase.from('logs').delete().eq('item_id', bi.id)
        await supabase.from('items').delete().eq('id', bi.id)
      }
      await supabase.from('categories').delete().eq('id', cat.id)
      toast.success(`"${cat.name}" permanently deleted`)
      setPurgeTarget(null)
      fetchBin()
    } catch {
      toast.error('Failed to delete')
    } finally {
      setWorking(false)
    }
  }

  // ── Empty bin ─────────────────────────────────────────────────
  async function emptyBin() {
    setWorking(true)
    try {
      for (const item of deletedItems) {
        await supabase.from('logs').delete().eq('item_id', item.id)
        await supabase.from('items').delete().eq('id', item.id)
      }
      for (const cat of deletedCats) {
        await supabase.from('categories').delete().eq('id', cat.id)
      }
      toast.success('Bin emptied')
      setConfirmEmpty(false)
      fetchBin()
    } catch {
      toast.error('Failed to empty bin')
    } finally {
      setWorking(false)
    }
  }

  const totalCount = deletedItems.length + deletedCats.length

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div
        className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3"
        style={{ borderBottom: '0.5px solid #F0D0DC' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Bin</h1>
            <p className="text-xs text-gray-400 mt-0.5">Items are permanently deleted after 30 days</p>
          </div>
          {totalCount > 0 && (
            <button
              onClick={() => setConfirmEmpty(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
              style={{ border: '0.5px solid #FCA5A5' }}
            >
              Empty bin
            </button>
          )}
        </div>
      </div>

      {/* Segmented control */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
          {(['items', 'categories'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {t === 'items' ? 'Items' : 'Categories'}
              {t === 'items' && deletedItems.length > 0 && ` (${deletedItems.length})`}
              {t === 'categories' && deletedCats.length > 0 && ` (${deletedCats.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-4 pb-6">
        {loading ? (
          <p className="text-sm text-gray-400 text-center pt-16">Loading…</p>
        ) : tab === 'items' ? (
          deletedItems.length === 0 ? (
            <EmptyBin label="No deleted items" />
          ) : (
            <div className="space-y-2">
              {deletedItems.map(item => (
                <BinRow
                  key={item.id}
                  icon={<Trash2 className="w-4 h-4 text-gray-400" />}
                  name={item.name}
                  deletedAt={item.deleted_at}
                  onRestore={() => restoreItem(item)}
                  onPurge={() => setPurgeTarget({ kind: 'item', record: item })}
                />
              ))}
            </div>
          )
        ) : (
          deletedCats.length === 0 ? (
            <EmptyBin label="No deleted categories" />
          ) : (
            <div className="space-y-2">
              {deletedCats.map(cat => (
                <BinRow
                  key={cat.id}
                  icon={
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                      style={{ backgroundColor: cat.color + '22' }}
                    >
                      {cat.icon}
                    </span>
                  }
                  name={cat.name}
                  deletedAt={cat.deleted_at}
                  onRestore={() => restoreCategory(cat)}
                  onPurge={() => setPurgeTarget({ kind: 'category', record: cat })}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Purge confirmation sheet ──────────────────────────────── */}
      {purgeTarget && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setPurgeTarget(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl"
            style={{ animation: 'slideUp 0.2s ease-out' }}
          >
            <div className="flex justify-center pt-3">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pt-4 pb-8">
              <div className="flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 text-center mb-1">
                Delete &ldquo;{purgeTarget.record.name}&rdquo; forever?
              </h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                This permanently removes the {purgeTarget.kind === 'category' ? 'category and any of its items still in the bin' : 'item and all its stock history'}. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPurgeTarget(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  style={{ border: '0.5px solid #E5E7EB' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    purgeTarget.kind === 'item'
                      ? purgeItem(purgeTarget.record)
                      : purgeCategory(purgeTarget.record)
                  }
                  disabled={working}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                >
                  {working ? 'Deleting…' : 'Delete forever'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Empty bin confirmation sheet ──────────────────────────── */}
      {confirmEmpty && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setConfirmEmpty(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl"
            style={{ animation: 'slideUp 0.2s ease-out' }}
          >
            <div className="flex justify-center pt-3">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pt-4 pb-8">
              <div className="flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 text-center mb-1">Empty bin?</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                This will permanently delete all {totalCount} item{totalCount !== 1 ? 's' : ''} in the bin, including all stock history. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmEmpty(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  style={{ border: '0.5px solid #E5E7EB' }}
                >
                  Cancel
                </button>
                <button
                  onClick={emptyBin}
                  disabled={working}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                >
                  {working ? 'Emptying…' : 'Empty bin'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function BinRow({
  icon,
  name,
  deletedAt,
  onRestore,
  onPurge,
}: {
  icon: React.ReactNode
  name: string
  deletedAt: string
  onRestore: () => void
  onPurge: () => void
}) {
  return (
    <div
      className="flex items-center gap-3 bg-white rounded-xl px-3 py-3"
      style={{ border: '0.5px solid #F0D0DC' }}
    >
      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-700 truncate">{name}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">Deleted {formatRelativeTime(deletedAt)}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onRestore}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-green-600 hover:bg-green-50 transition-colors"
          style={{ border: '0.5px solid #BBF7D0' }}
        >
          <RotateCcw className="w-3 h-3" />
          Restore
        </button>
        <button
          onClick={onPurge}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
          style={{ border: '0.5px solid #FCA5A5' }}
        >
          <Trash2 className="w-3 h-3" />
          Forever
        </button>
      </div>
    </div>
  )
}

function EmptyBin({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <PackageOpen className="w-12 h-12 mb-3 opacity-20" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}
