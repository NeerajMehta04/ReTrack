'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import { Trash2, RotateCcw, Package, PackageOpen } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

type DeletedItem = { id: string; name: string; deleted_at: string }
type DeletedCategory = { id: string; name: string; icon: string; color: string; deleted_at: string }
type PurgeTarget = { kind: 'item'; record: DeletedItem } | { kind: 'category'; record: DeletedCategory }

export default function OrgBinPage() {
  const { org } = useOrg()
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
      supabase.from('items').select('id, name, deleted_at').eq('org_id', org.id).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('categories').select('id, name, icon, color, deleted_at').eq('org_id', org.id).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ])
    setDeletedItems((itemsRes.data as DeletedItem[]) ?? [])
    setDeletedCats((catsRes.data as DeletedCategory[]) ?? [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { fetchBin() }, [fetchBin])

  useEffect(() => {
    const anyOpen = !!purgeTarget || confirmEmpty
    document.body.style.overflow = anyOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [purgeTarget, confirmEmpty])

  async function restoreItem(item: DeletedItem) {
    const { error } = await supabase.from('items').update({ deleted_at: null }).eq('id', item.id)
    if (error) { toast.error('Restore failed'); return }
    toast.success(`"${item.name}" restored`)
    fetchBin()
  }

  async function restoreCategory(cat: DeletedCategory) {
    await supabase.from('categories').update({ deleted_at: null }).eq('id', cat.id)
    await supabase.from('items').update({ deleted_at: null }).eq('category_id', cat.id).eq('org_id', org.id).not('deleted_at', 'is', null)
    toast.success(`"${cat.name}" restored`)
    fetchBin()
  }

  async function purge() {
    if (!purgeTarget) return
    setWorking(true)
    try {
      if (purgeTarget.kind === 'item') {
        await supabase.from('logs').delete().eq('item_id', purgeTarget.record.id)
        await supabase.from('items').delete().eq('id', purgeTarget.record.id)
      } else {
        await supabase.from('items').select('id').eq('category_id', purgeTarget.record.id).eq('org_id', org.id).then(async ({ data: items }) => {
          if (items) {
            for (const item of items) {
              await supabase.from('logs').delete().eq('item_id', item.id)
            }
          }
        })
        await supabase.from('items').delete().eq('category_id', purgeTarget.record.id).eq('org_id', org.id)
        await supabase.from('categories').delete().eq('id', purgeTarget.record.id)
      }
      toast.success('Permanently deleted')
      setPurgeTarget(null)
      fetchBin()
    } catch {
      toast.error('Delete failed')
    } finally {
      setWorking(false)
    }
  }

  async function emptyBin() {
    setWorking(true)
    try {
      for (const item of deletedItems) {
        await supabase.from('logs').delete().eq('item_id', item.id)
        await supabase.from('items').delete().eq('id', item.id)
      }
      for (const cat of deletedCats) {
        const { data: catItems } = await supabase.from('items').select('id').eq('category_id', cat.id).eq('org_id', org.id)
        if (catItems) {
          for (const item of catItems) await supabase.from('logs').delete().eq('item_id', item.id)
        }
        await supabase.from('items').delete().eq('category_id', cat.id).eq('org_id', org.id)
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

  const currentList = tab === 'items' ? deletedItems : deletedCats
  const isEmpty = deletedItems.length === 0 && deletedCats.length === 0

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Bin</h1>
            <p className="text-xs text-gray-400 mt-0.5">{org.name}</p>
          </div>
          {!isEmpty && (
            <button onClick={() => setConfirmEmpty(true)} className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors">
              Empty bin
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {(['items', 'categories'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${tab === t ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
              {t} {t === 'items' ? `(${deletedItems.length})` : `(${deletedCats.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <PackageOpen className="w-12 h-12 mb-3 opacity-25" />
            <p className="text-sm font-medium">
              {tab === 'items' ? 'No deleted items' : 'No deleted categories'}
            </p>
          </div>
        ) : tab === 'items' ? (
          deletedItems.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3" style={{ border: '0.5px solid #E5E7EB' }}>
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Deleted {formatRelativeTime(item.deleted_at)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => restoreItem(item)} className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setPurgeTarget({ kind: 'item', record: item })} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          deletedCats.map(cat => (
            <div key={cat.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3" style={{ border: '0.5px solid #E5E7EB' }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{cat.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{cat.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Deleted {formatRelativeTime(cat.deleted_at)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => restoreCategory(cat)} className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setPurgeTarget({ kind: 'category', record: cat })} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Purge confirm */}
      {purgeTarget && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setPurgeTarget(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl p-5 shadow-2xl">
            <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-500" /></div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-1">Permanently delete?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              &ldquo;{purgeTarget.kind === 'item' ? purgeTarget.record.name : purgeTarget.record.name}&rdquo; and all its data will be gone forever.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPurgeTarget(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors" style={{ border: '0.5px solid #E5E7EB' }}>Cancel</button>
              <button onClick={purge} disabled={working} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">{working ? 'Deleting…' : 'Delete forever'}</button>
            </div>
          </div>
        </>
      )}

      {/* Empty bin confirm */}
      {confirmEmpty && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setConfirmEmpty(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl p-5 shadow-2xl">
            <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
            <div className="flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mx-auto mb-4"><Package className="w-6 h-6 text-red-500" /></div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-1">Empty the entire bin?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">All {deletedItems.length + deletedCats.length} items in the bin will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmEmpty(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors" style={{ border: '0.5px solid #E5E7EB' }}>Cancel</button>
              <button onClick={emptyBin} disabled={working} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">{working ? 'Deleting…' : 'Empty bin'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
