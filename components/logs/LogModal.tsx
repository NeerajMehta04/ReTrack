'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Item, Group } from '@/types'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  items: Item[]
  groups: Group[]
  onSaved: () => void
}

type Direction = 'in' | 'out'
type Condition = 'good' | 'fair' | 'poor' | ''

export default function LogModal({ open, onClose, items, groups, onSaved }: Props) {
  const [direction, setDirection] = useState<Direction>('in')
  const [itemId, setItemId] = useState('')
  const [amount, setAmount] = useState('')
  const [groupId, setGroupId] = useState('')
  const [condition, setCondition] = useState<Condition>('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!open) {
      setDirection('in')
      setItemId('')
      setAmount('')
      setGroupId('')
      setCondition('')
      setComment('')
    }
  }, [open])

  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleSave() {
    if (!itemId) { toast.error('Please select an item'); return }
    const qty = parseInt(amount)
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return }

    const selectedItem = items.find(i => i.id === itemId)
    if (direction === 'out' && selectedItem && selectedItem.stock < qty) {
      toast.error(`Only ${selectedItem.stock} in stock`)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('logs').insert({
        item_id: itemId,
        direction,
        amount: qty,
        group_id: groupId || null,
        condition: condition || null,
        comment: comment.trim() || null,
      })
      if (error) throw error

      toast.success('Movement logged!')
      onSaved()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-30 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Scrollable content */}
        <div className="px-5 pt-3 pb-8 max-h-[85vh] overflow-y-auto">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">Log Movement</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>

          {/* Direction toggle */}
          <div className="flex gap-2 mb-5 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setDirection('in')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                direction === 'in'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              ↑ In (received)
            </button>
            <button
              onClick={() => setDirection('out')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                direction === 'out'
                  ? 'bg-white text-red-500 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              ↓ Out (given away)
            </button>
          </div>

          {/* Item picker */}
          <div className="mb-3.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Item *
            </label>
            <select
              value={itemId}
              onChange={e => setItemId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
              style={{ border: '0.5px solid #E5E7EB' }}
            >
              <option value="">Select an item…</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} (stock: {item.stock})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div className="mb-3.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Quantity *
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="1"
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ border: '0.5px solid #E5E7EB' }}
            />
          </div>

          {/* Group */}
          <div className="mb-3.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Group / Student
            </label>
            <select
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
              style={{ border: '0.5px solid #E5E7EB' }}
            >
              <option value="">— Optional —</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div className="mb-3.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Condition
            </label>
            <div className="flex gap-2">
              {(['good', 'fair', 'poor'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setCondition(prev => prev === c ? '' : c)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                    condition === c
                      ? c === 'good'
                        ? 'bg-green-500 text-white shadow-sm'
                        : c === 'fair'
                        ? 'bg-yellow-400 text-white shadow-sm'
                        : 'bg-red-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="mb-5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Comment
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Optional note…"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              style={{ border: '0.5px solid #E5E7EB' }}
            />
          </div>

          {/* Buttons */}
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
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
