'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types'
import { Plus, MoreHorizontal, Check, Trash2, X, Package, Pencil } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'

interface CategoryWithCount extends Category {
  item_count: number
}

const PRESET_COLORS = [
  '#8B5CF6', '#F59E0B', '#3B82F6', '#10B981',
  '#EF4444', '#EC4899', '#6B7280', '#D4537E',
]

const EMOJIS = [
  // Furniture
  '🪑','🛋️','🛏️','🚪','🪞','🪟','🖼️','🪣',
  // Kitchen
  '🍽️','🥣','🥛','☕','🍳','🔪','🫙','🧊',
  // Office / tech
  '💼','🖥️','⌨️','🖨️','📱','💡','🔌','📎',
  // Tools / storage
  '🧰','📦','🗃️','🗄️','📋','🔧','🪛','🔑',
  // Transport
  '🚲','🛴','🛒','🚗',
  // Clothes / textiles
  '👕','👖','🧥','👟','🧤','🎒','👜','🧺',
  // Nature / plants
  '🌱','🪴','🌿','🍀','🌸','🌻','🍁','🪨',
  // Misc
  '⭐','❤️','✅','🏷️','🎁','♻️','🔖','📌',
]

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Create sheet
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📦')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [creating, setCreating] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)

  // Edit sheet
  const [editCat, setEditCat] = useState<CategoryWithCount | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('📦')
  const [editColor, setEditColor] = useState(PRESET_COLORS[0])
  const [editEmojiOpen, setEditEmojiOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Action / delete sheets
  const [actionSheetCat, setActionSheetCat] = useState<CategoryWithCount | null>(null)
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<CategoryWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchCategories = useCallback(async () => {
    const { data: cats } = await supabase.from('categories').select('*').is('deleted_at', null).order('name')
    if (!cats) { setLoading(false); return }

    const withCounts = await Promise.all(
      cats.map(async cat => {
        const { count } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', cat.id)
        return { ...cat, item_count: count ?? 0 }
      })
    )
    setCategories(withCounts)
    setLoading(false)
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  useEffect(() => {
    if (editCat) {
      setEditName(editCat.name)
      setEditIcon(editCat.icon)
      setEditColor(editCat.color)
      setEditEmojiOpen(false)
    }
  }, [editCat])

  // Body scroll lock
  useEffect(() => {
    const anyOpen = createOpen || !!editCat || !!actionSheetCat || !!confirmDeleteCat
    document.body.style.overflow = anyOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [createOpen, editCat, actionSheetCat, confirmDeleteCat])

  function openCreate() {
    setNewName('')
    setNewIcon('📦')
    setNewColor(PRESET_COLORS[0])
    setEmojiPickerOpen(false)
    setCreateOpen(true)
  }

  async function handleCreate() {
    if (!newName.trim()) { toast.error('Name is required'); return }
    setCreating(true)
    try {
      const { error } = await supabase.from('categories').insert({
        name: newName.trim(),
        icon: newIcon.trim() || '📦',
        color: newColor,
      })
      if (error) throw error
      toast.success('Category created')
      setCreateOpen(false)
      fetchCategories()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  async function handleEditSave() {
    if (!editCat || !editName.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const { error } = await supabase
      .from('categories')
      .update({ name: editName.trim(), icon: editIcon, color: editColor })
      .eq('id', editCat.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Category updated')
    setEditCat(null)
    fetchCategories()
  }

  async function handleDeleteWithItems(cat: CategoryWithCount) {
    setDeleting(true)
    const now = new Date().toISOString()
    try {
      const { error: itemsErr } = await supabase.from('items').update({ deleted_at: now }).eq('category_id', cat.id)
      if (itemsErr) throw itemsErr
      const { error: catErr } = await supabase.from('categories').update({ deleted_at: now }).eq('id', cat.id)
      if (catErr) throw catErr
      toast.success(`"${cat.name}" moved to bin`)
      setConfirmDeleteCat(null)
      fetchCategories()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  async function handleDeleteOnly(cat: CategoryWithCount) {
    setDeleting(true)
    try {
      const { error: updateErr } = await supabase.from('items').update({ category_id: null }).eq('category_id', cat.id)
      if (updateErr) throw updateErr
      const { error: catErr } = await supabase.from('categories').update({ deleted_at: new Date().toISOString() }).eq('id', cat.id)
      if (catErr) throw catErr
      toast.success(`"${cat.name}" moved to bin — items kept as uncategorised`)
      setConfirmDeleteCat(null)
      fetchCategories()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div
        className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3"
        style={{ borderBottom: '0.5px solid #F0D0DC' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Categories</h1>
            <p className="text-xs text-gray-400 mt-0.5">Tap a row to filter items</p>
          </div>
          <button
            onClick={openCreate}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm shadow-primary/20 hover:bg-primary-dark active:scale-95 transition-all"
            aria-label="Add category"
          >
            <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ border: '0.5px solid #F0D0DC' }}
        >
          {/* Table header */}
          <div
            className="flex items-center px-4 py-2 bg-gray-50"
            style={{ borderBottom: '0.5px solid #F0D0DC' }}
          >
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex-1">Category</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-10 text-center">Icon</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-12 text-right">Items</span>
            <span className="w-9" />
          </div>

          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center px-4 py-3.5"
                  style={{ borderBottom: '0.5px solid #F5F5F5' }}
                >
                  <Skeleton className="h-4 w-28 flex-1" />
                  <div className="flex justify-center w-10">
                    <Skeleton className="h-7 w-7 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-8 ml-auto mr-0 w-12" />
                  <div className="w-9" />
                </div>
              ))
            : categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  className="flex items-center"
                  style={{
                    borderBottom: idx < categories.length - 1 ? '0.5px solid #F5F5F5' : undefined,
                  }}
                >
                  {/* Clickable area */}
                  <button
                    onClick={() => router.push(`/items?category=${cat.id}`)}
                    className="flex items-center flex-1 min-w-0 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                  >
                    <span className="font-semibold text-sm text-gray-900 flex-1 truncate">{cat.name}</span>

                    <div className="flex justify-center w-10">
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                        style={{ backgroundColor: cat.color + '22' }}
                      >
                        {cat.icon}
                      </span>
                    </div>

                    <span className="text-sm font-bold text-gray-800 w-12 text-right">{cat.item_count}</span>
                  </button>

                  {/* ⋯ button */}
                  <button
                    onClick={() => setActionSheetCat(cat)}
                    className="w-9 h-9 mr-2 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              ))}
        </div>
      </div>

      {/* ── Create Category Sheet ─────────────────────────────────── */}
      {createOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setCreateOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl"
            style={{ animation: 'slideUp 0.25s ease-out' }}
          >
            <div className="flex justify-center pt-3">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pt-3 pb-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-900">New Category</h2>
                <button
                  onClick={() => setCreateOpen(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>

              {/* Name */}
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="e.g. Kitchen"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  style={{ border: '0.5px solid #E5E7EB' }}
                />
              </div>

              {/* Emoji icon */}
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Emoji Icon
                </label>
                <button
                  type="button"
                  onClick={() => setEmojiPickerOpen(v => !v)}
                  className="w-14 h-14 rounded-xl bg-gray-50 text-3xl flex items-center justify-center transition-colors hover:bg-gray-100"
                  style={{ border: '0.5px solid #E5E7EB' }}
                >
                  {newIcon}
                </button>
                {emojiPickerOpen && (
                  <div className="grid grid-cols-8 gap-1 mt-2 p-2 bg-gray-50 rounded-xl max-h-48 overflow-y-auto">
                    {EMOJIS.map(e => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => { setNewIcon(e); setEmojiPickerOpen(false) }}
                        className={`text-2xl p-1 rounded-lg flex items-center justify-center transition-colors hover:bg-white ${
                          newIcon === e ? 'bg-white ring-2 ring-primary' : ''
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Colour swatches */}
              <div className="mb-6">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Colour
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                      style={{
                        backgroundColor: color,
                        boxShadow: newColor === color
                          ? `0 0 0 2px white, 0 0 0 4px ${color}`
                          : undefined,
                      }}
                      aria-label={color}
                    >
                      {newColor === color && (
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  style={{ border: '0.5px solid #E5E7EB' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors shadow-sm shadow-primary/20"
                >
                  {creating ? 'Creating…' : 'Create category'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Action Sheet ──────────────────────────────────────────── */}
      {actionSheetCat && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setActionSheetCat(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl"
            style={{ animation: 'slideUp 0.2s ease-out' }}
          >
            <div className="flex justify-center pt-3">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pt-3 pb-8">
              <p className="text-xs text-gray-400 text-center mb-4 font-medium">{actionSheetCat.name}</p>
              <button
                onClick={() => { const cat = actionSheetCat; setActionSheetCat(null); setEditCat(cat) }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-primary-light transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-primary-light flex items-center justify-center">
                  <Pencil className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-semibold text-gray-800">Edit</span>
              </button>
              <button
                onClick={() => { const cat = actionSheetCat; setActionSheetCat(null); setConfirmDeleteCat(cat) }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-red-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm font-semibold text-red-600">Delete</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Edit Category Sheet ──────────────────────────────────── */}
      {editCat && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setEditCat(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl"
            style={{ animation: 'slideUp 0.25s ease-out' }}
          >
            <div className="flex justify-center pt-3">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pt-3 pb-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-900">Edit Category</h2>
                <button
                  onClick={() => setEditCat(null)}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>

              {/* Name */}
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Name *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEditSave()}
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  style={{ border: '0.5px solid #E5E7EB' }}
                />
              </div>

              {/* Emoji icon */}
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Emoji Icon
                </label>
                <button
                  type="button"
                  onClick={() => setEditEmojiOpen(v => !v)}
                  className="w-14 h-14 rounded-xl bg-gray-50 text-3xl flex items-center justify-center transition-colors hover:bg-gray-100"
                  style={{ border: '0.5px solid #E5E7EB' }}
                >
                  {editIcon}
                </button>
                {editEmojiOpen && (
                  <div className="grid grid-cols-8 gap-1 mt-2 p-2 bg-gray-50 rounded-xl max-h-48 overflow-y-auto">
                    {EMOJIS.map(e => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => { setEditIcon(e); setEditEmojiOpen(false) }}
                        className={`text-2xl p-1 rounded-lg flex items-center justify-center transition-colors hover:bg-white ${
                          editIcon === e ? 'bg-white ring-2 ring-primary' : ''
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Colour swatches */}
              <div className="mb-6">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Colour
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                      style={{
                        backgroundColor: color,
                        boxShadow: editColor === color
                          ? `0 0 0 2px white, 0 0 0 4px ${color}`
                          : undefined,
                      }}
                      aria-label={color}
                    >
                      {editColor === color && (
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setEditCat(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  style={{ border: '0.5px solid #E5E7EB' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={saving}
                  className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors shadow-sm shadow-primary/20"
                >
                  {saving ? 'Saving…' : 'Update category'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Delete Confirmation ───────────────────────────────────── */}
      {confirmDeleteCat && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setConfirmDeleteCat(null)} />
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
                Delete &ldquo;{confirmDeleteCat.name}&rdquo;?
              </h3>
              <p className="text-sm text-gray-500 text-center mb-5">
                Choose what happens to the {confirmDeleteCat.item_count} item{confirmDeleteCat.item_count !== 1 ? 's' : ''} inside:
              </p>

              <div className="flex flex-col gap-2 mb-4">
                {/* Delete category & items */}
                <button
                  onClick={() => handleDeleteWithItems(confirmDeleteCat)}
                  disabled={deleting}
                  className="w-full flex flex-col gap-0.5 px-4 py-3 rounded-xl text-left disabled:opacity-60 transition-colors hover:brightness-95"
                  style={{ border: '0.5px solid #FCA5A5', background: '#FFF5F5' }}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-red-600">
                    <Trash2 className="w-4 h-4 flex-shrink-0" />
                    Delete category &amp; items
                  </span>
                  <span className="text-xs text-red-400 pl-6">Permanently removes everything including stock history</span>
                </button>

                {/* Delete category only */}
                <button
                  onClick={() => handleDeleteOnly(confirmDeleteCat)}
                  disabled={deleting}
                  className="w-full flex flex-col gap-0.5 px-4 py-3 rounded-xl text-left disabled:opacity-60 transition-colors hover:brightness-95"
                  style={{ border: '0.5px solid #E5E7EB', background: '#F9FAFB' }}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Package className="w-4 h-4 flex-shrink-0" />
                    Delete category only
                  </span>
                  <span className="text-xs text-gray-400 pl-6">Items remain but become uncategorised</span>
                </button>
              </div>

              <button
                onClick={() => setConfirmDeleteCat(null)}
                className="w-full py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
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
