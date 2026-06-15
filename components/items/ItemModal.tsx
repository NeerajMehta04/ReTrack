'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Item, Category } from '@/types'
import { X, ImagePlus, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  categories: Category[]
  item?: Item | null
  onSaved: (item: Item, logsRefreshed?: boolean) => void
}

interface PendingSave {
  computedStock: number
  newStock: number
  imageUrl: string | null
}

export default function ItemModal({ open, onClose, categories, item, onSaved }: Props) {
  const isEdit = !!item
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stock, setStock] = useState('0')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)

  // Warning sheet state
  const [showWarning, setShowWarning] = useState(false)
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null)
  const [correctionNote, setCorrectionNote] = useState('')

  const supabase = createClient()

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '')
      setDescription(item?.description ?? '')
      setCategoryId(item?.category_id ?? '')
      setStock(String(item?.stock ?? 0))
      setImagePreview(item?.image_url ?? '')
      setImageFile(null)
      setShowWarning(false)
      setPendingSave(null)
      setCorrectionNote('')
    }
  }, [open, item])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImage(itemId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `${itemId}.${ext}`
    const { error } = await supabase.storage.from('items').upload(path, file, { upsert: true })
    if (error) throw error
    return supabase.storage.from('items').getPublicUrl(path).data.publicUrl
  }

  // ── Shared update executor ─────────────────────────────────────────────────
  // stockValue: what to write directly to items.stock
  // correctionLog: if set, insert this log after (trigger fires → net = newStock)
  async function doEditSave(
    resolvedImageUrl: string | null,
    stockValue: number,
    correctionLog: { direction: 'in' | 'out'; amount: number; comment: string } | null
  ) {
    if (!item) return
    setSaving(true)
    try {
      // If image wasn't pre-uploaded (no-stock-change path), upload now
      let finalImageUrl = resolvedImageUrl
      if (finalImageUrl === null && imageFile) {
        finalImageUrl = await uploadImage(item.id, imageFile)
      }

      // Write item metadata + stock value (will be overridden by trigger if correction log follows)
      const { error: updateErr } = await supabase
        .from('items')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          category_id: categoryId || null,
          image_url: finalImageUrl,
          stock: stockValue,
        })
        .eq('id', item.id)
      if (updateErr) throw updateErr

      // Insert correction log — trigger fires and adjusts stock to newStock
      if (correctionLog) {
        const { error: logErr } = await supabase.from('logs').insert({
          item_id: item.id,
          direction: correctionLog.direction,
          amount: correctionLog.amount,
          comment: correctionLog.comment,
        })
        if (logErr) throw logErr
      }

      // Fetch the updated item (stock may have been adjusted by trigger)
      const { data: updated, error: fetchErr } = await supabase
        .from('items')
        .select('*, categories(*)')
        .eq('id', item.id)
        .single()
      if (fetchErr) throw fetchErr

      toast.success(correctionLog ? 'Correction saved!' : 'Item updated!')
      onSaved(updated, !!correctionLog)
      setShowWarning(false)
      setPendingSave(null)
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Primary save handler ───────────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) { toast.error('Name is required'); return }

    // ── Create path ────────────────────────────────────────────────────────
    if (!isEdit || !item) {
      setSaving(true)
      try {
        const { data: newItem, error: createErr } = await supabase
          .from('items')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            category_id: categoryId || null,
            stock: Math.max(0, parseInt(stock) || 0),
          })
          .select('*, categories(*)')
          .single()
        if (createErr) throw createErr

        if (imageFile) {
          const imageUrl = await uploadImage(newItem.id, imageFile)
          await supabase.from('items').update({ image_url: imageUrl }).eq('id', newItem.id)
          newItem.image_url = imageUrl
        }

        toast.success('Item added!')
        onSaved(newItem)
        onClose()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to save')
      } finally {
        setSaving(false)
      }
      return
    }

    // ── Edit path ──────────────────────────────────────────────────────────
    const newStock = Math.max(0, parseInt(stock) || 0)
    const stockChanged = newStock !== item.stock

    if (!stockChanged) {
      // No stock change — just update metadata (image upload happens inside doEditSave)
      await doEditSave(item.image_url, item.stock, null)
      return
    }

    // Stock changed — fetch log history to check for mismatch
    setSaving(true)
    let resolvedImageUrl: string | null = item.image_url
    try {
      if (imageFile) resolvedImageUrl = await uploadImage(item.id, imageFile)

      const { data: logHistory } = await supabase
        .from('logs')
        .select('direction, amount')
        .eq('item_id', item.id)

      const computedStock = (logHistory ?? []).reduce<number>(
        (sum, l) => l.direction === 'in' ? sum + l.amount : sum - l.amount,
        0
      )

      if (newStock === computedStock) {
        // No mismatch — user typed the log-computed value, write directly, no correction log
        await doEditSave(resolvedImageUrl, newStock, null)
      } else {
        // Mismatch — show warning before proceeding
        setPendingSave({ computedStock, newStock, imageUrl: resolvedImageUrl })
        setShowWarning(true)
        setSaving(false)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  // ── Confirmation handler (called from warning sheet) ───────────────────────
  async function confirmCorrection() {
    if (!pendingSave || !item) return
    const { computedStock, newStock, imageUrl } = pendingSave
    const delta = newStock - computedStock

    await doEditSave(
      imageUrl,
      computedStock, // reset to what logs say, then trigger adjusts
      {
        direction: delta >= 0 ? 'in' : 'out',
        amount: Math.abs(delta),
        comment: `Manual correction: ${item.stock} → ${newStock}${correctionNote.trim() ? ' · ' + correctionNote.trim() : ''}`,
      }
    )
  }

  if (!open) return null

  const delta = pendingSave ? pendingSave.newStock - pendingSave.computedStock : 0
  const deltaLabel = delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 bg-black/40 z-30" onClick={showWarning ? undefined : onClose} />

      {/* ── Main modal sheet ──────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pt-3 pb-8 max-h-[88vh] overflow-y-auto">
          {/* Title */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? 'Edit Item' : 'Add Item'}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>

          {/* Image picker */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Photo
            </label>
            <label className="block cursor-pointer group">
              <div
                className="w-full h-36 rounded-xl overflow-hidden bg-primary-light flex items-center justify-center transition-colors group-hover:bg-pink-100"
                style={{ border: '1.5px dashed #D4537E44' }}
              >
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    width={400}
                    height={144}
                    className="object-cover w-full h-full"
                    unoptimized={imagePreview.startsWith('blob:')}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-primary/40">
                    <ImagePlus className="w-7 h-7" />
                    <span className="text-xs font-medium">Tap to upload</span>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
            </label>
            {imagePreview && (
              <button
                onClick={() => { setImageFile(null); setImagePreview('') }}
                className="mt-1.5 text-[10px] text-gray-400 hover:text-red-400 transition-colors"
              >
                Remove photo
              </button>
            )}
          </div>

          {/* Name */}
          <div className="mb-3.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Folding Chair"
              autoFocus={!isEdit}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ border: '0.5px solid #E5E7EB' }}
            />
          </div>

          {/* Description */}
          <div className="mb-3.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description…"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              style={{ border: '0.5px solid #E5E7EB' }}
            />
          </div>

          {/* Category */}
          <div className="mb-3.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Category
            </label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
              style={{ border: '0.5px solid #E5E7EB' }}
            >
              <option value="">— No category —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          {/* Stock */}
          <div className="mb-5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              {isEdit ? 'Stock (direct correction)' : 'Initial Stock'}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={stock}
              onChange={e => setStock(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ border: '0.5px solid #E5E7EB' }}
            />
            {isEdit && (
              <p className="text-[10px] text-gray-400 mt-1.5">
                For routine movements, use the Logs tab to keep a full history.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ border: '0.5px solid #E5E7EB' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors shadow-sm shadow-primary/20"
            >
              {saving ? 'Checking…' : isEdit ? 'Update' : 'Add Item'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Warning confirmation sheet (z-50, stacked above modal) ─────────── */}
      {showWarning && pendingSave && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl"
          style={{ animation: 'slideUp 0.2s ease-out' }}
        >
          <div className="flex justify-center pt-3">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="px-5 pt-4 pb-8">
            {/* Icon + title */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Stock mismatch</h3>
                <p className="text-xs text-gray-400">A correction entry will be created</p>
              </div>
            </div>

            {/* Mismatch details */}
            <div className="bg-amber-50 rounded-2xl p-4 mb-5 space-y-2 text-sm" style={{ border: '0.5px solid #FCD34D' }}>
              <div className="flex justify-between">
                <span className="text-gray-500">Log history sums to</span>
                <span className="font-semibold text-gray-900">{pendingSave.computedStock} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">You're setting it to</span>
                <span className="font-semibold text-gray-900">{pendingSave.newStock} units</span>
              </div>
              <div
                className="flex justify-between pt-2"
                style={{ borderTop: '0.5px solid #FCD34D' }}
              >
                <span className="text-gray-500">Correction entry</span>
                <span className={`font-bold text-base ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {deltaLabel}
                </span>
              </div>
            </div>

            {/* Optional note */}
            <input
              type="text"
              value={correctionNote}
              onChange={e => setCorrectionNote(e.target.value)}
              placeholder="Reason for correction (optional)"
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary mt-3 mb-4"
              style={{ border: '0.5px solid #E5E7EB' }}
            />

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                style={{ border: '0.5px solid #E5E7EB' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmCorrection}
                disabled={saving}
                className="flex-1 py-3 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Saving…' : 'Confirm correction'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
