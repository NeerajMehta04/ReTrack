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
  orgId?: string | null
}

type Direction = 'in' | 'out'
type Condition = 'good' | 'fair' | 'poor' | ''

export default function LogModal({ open, onClose, items, onSaved, orgId }: Props) {
  const [direction, setDirection] = useState<Direction>('in')
  const [itemId, setItemId] = useState('')
  const [amount, setAmount] = useState('')
  const [condition, setCondition] = useState<Condition>('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!open) {
      setDirection('in')
      setItemId('')
      setAmount('')
      setCondition('')
      setComment('')
    }
  }, [open])

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
        condition: condition || null,
        comment: comment.trim() || null,
        ...(orgId ? { org_id: orgId } : {}),
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
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />

      <div
        className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-5 pt-3 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">Log Movement</h2>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <X className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>

          {/* Direction */}
          <div className="flex gap-1.5 mb-4 p-1 bg-gray-100 rounded-xl">
            <button onClick={() => setDirection('in')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${direction === 'in' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>
              ↑ In (received)
            </button>
            <button onClick={() => setDirection('out')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${direction === 'out' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500'}`}>
              ↓ Out (given away)
            </button>
          </div>

          {/* Item */}
          <select
            value={itemId}
            onChange={e => setItemId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary appearance-none mb-3"
            style={{ border: '0.5px solid #E5E7EB' }}
          >
            <option value="">Select item…</option>
            {items.map(item => (
              <option key={item.id} value={item.id}>{item.name} ({item.stock} in stock)</option>
            ))}
          </select>

          {/* Condition chips */}
          <div className="flex gap-1.5 mb-3">
            {(['good', 'fair', 'poor'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCondition(prev => prev === c ? '' : c)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  condition === c
                    ? c === 'good' ? 'bg-green-500 text-white shadow-sm'
                    : c === 'fair' ? 'bg-yellow-400 text-white shadow-sm'
                    : 'bg-red-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Qty + Comment + Log row */}
          <div className="flex gap-2 mb-5">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Qty"
              className="w-[72px] px-3 py-2.5 rounded-xl text-sm text-center font-semibold focus:outline-none focus:ring-1 focus:ring-primary flex-shrink-0"
              style={{ border: '0.5px solid #E5E7EB' }}
            />
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Comment (optional)"
              className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ border: '0.5px solid #E5E7EB' }}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors shadow-sm shadow-primary/20 flex-shrink-0"
            >
              {saving ? '…' : 'Log'}
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
