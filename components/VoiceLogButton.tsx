'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Check, Plus, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types'
import toast from 'react-hot-toast'

// ── Constants (mirrors ItemModal.tsx) ─────────────────────────────────────────
const CAT_COLORS = ['#8B5CF6','#F59E0B','#3B82F6','#10B981','#EF4444','#EC4899','#6B7280','#D4537E']

const CAT_EMOJIS = [
  '🪑','🛋️','🛏️','🚪','🪞','🪟','🖼️','🪣',
  '🍽️','🥣','🥛','☕','🍳','🔪','🫙','🧊',
  '💼','🖥️','⌨️','🖨️','📱','💡','🔌','📎',
  '🧰','📦','🗃️','🗄️','📋','🔧','🪛','🔑',
  '🚲','🛴','🛒','🚗',
  '👕','👖','🧥','👟','🧤','🎒','👜','🧺',
  '🌱','🪴','🌿','🍀','🌸','🌻','🍁','🪨',
  '⭐','❤️','✅','🏷️','🎁','♻️','🔖','📌',
]

const toTitleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase())

// ── Types ─────────────────────────────────────────────────────────────────────
type Item = { id: string; name: string }

type Condition = 'good' | 'fair' | 'poor'

type UpdateRow = {
  item_id: string | null
  item_name: string
  direction: 'in' | 'out'
  quantity: number
  condition: Condition | null
}

const CONDITIONS: { value: Condition; label: string; activeClass: string }[] = [
  { value: 'good', label: 'Good', activeClass: 'bg-green-500 text-white' },
  { value: 'fair', label: 'Fair', activeClass: 'bg-yellow-400 text-white' },
  { value: 'poor', label: 'Poor', activeClass: 'bg-red-500 text-white' },
]

type Stage = 'idle' | 'recording' | 'processing' | 'confirming'

// ── Component ─────────────────────────────────────────────────────────────────
export default function VoiceLogButton({ onLogged, offset = 'bottom-20 right-4', orgId }: { onLogged?: () => void; offset?: string; orgId?: string | null }) {
  const supabase = createClient()

  // Core state
  const [stage, setStage] = useState<Stage>('idle')
  const [items, setItems] = useState<Item[]>([])
  const [localCategories, setLocalCategories] = useState<Category[]>([])
  const [transcript, setTranscript] = useState('')
  const [updates, setUpdates] = useState<UpdateRow[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [confirming, setConfirming] = useState(false)

  // New-item inline form state
  const [newItemRowIdx, setNewItemRowIdx] = useState<number | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCatId, setNewItemCatId] = useState('')
  const [creatingItem, setCreatingItem] = useState(false)

  // Inline category creation (inside new-item form)
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📦')
  const [newCatColor, setNewCatColor] = useState(CAT_COLORS[0])
  const [creatingCat, setCreatingCat] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch items + categories on mount
  useEffect(() => {
    let itemsQuery = supabase.from('items').select('id, name').is('deleted_at', null).order('name')
    let catsQuery  = supabase.from('categories').select('*').order('name')
    if (orgId) {
      itemsQuery = itemsQuery.eq('org_id', orgId)
      catsQuery  = catsQuery.eq('org_id', orgId)
    } else {
      itemsQuery = itemsQuery.is('org_id', null)
      catsQuery  = catsQuery.is('org_id', null)
    }
    itemsQuery.then(({ data }) => setItems(data ?? []))
    catsQuery.then(({ data }) => setLocalCategories(data ?? []))
  }, [orgId])

  // Recording timer
  useEffect(() => {
    if (stage === 'recording') {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [stage])

  // ── Audio processing ─────────────────────────────────────────────────────────
  const processAudio = useCallback(async (blob: Blob) => {
    const fd = new FormData()
    fd.append('audio', blob)
    fd.append('items', JSON.stringify(items.map(i => ({ id: i.id, name: i.name }))))

    const res = await fetch('/api/voice-log', { method: 'POST', body: fd })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.error('Voice log API error:', errData)
      toast.error(errData.detail ? `Error: ${errData.detail}` : 'Could not process voice note')
      setStage('idle')
      return
    }
    const data = await res.json()
    setTranscript(data.transcript ?? '')
    setUpdates(
      data.updates?.length
        ? data.updates.map((u: UpdateRow) => ({ ...u, condition: null }))
        : [{ item_id: null, item_name: '', direction: 'in' as const, quantity: 1, condition: null }]
    )
    setStage('confirming')
  }, [items])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setStage('processing')
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' })
        await processAudio(blob)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setStage('recording')
    } catch {
      toast.error('Microphone access denied')
    }
  }, [processAudio])

  // ── Row helpers ───────────────────────────────────────────────────────────────
  const addRow = () =>
    setUpdates(u => [...u, { item_id: null, item_name: '', direction: 'in', quantity: 1, condition: null }])

  const removeRow = (i: number) => {
    setUpdates(u => u.filter((_, idx) => idx !== i))
    if (newItemRowIdx === i) setNewItemRowIdx(null)
  }

  const updateRow = (i: number, patch: Partial<UpdateRow>) =>
    setUpdates(u => u.map((row, idx) => idx === i ? { ...row, ...patch } : row))

  const handleItemChange = (i: number, id: string) => {
    if (id === '__new_item__') {
      // Open inline new-item form, pre-fill from AI-parsed name if unmatched
      const currentRow = updates[i]
      setNewItemRowIdx(i)
      setNewItemName(currentRow.item_id === null ? toTitleCase(currentRow.item_name) : '')
      setNewItemCatId('')
      setShowNewCat(false)
      setNewCatName('')
      setNewCatIcon('📦')
      setNewCatColor(CAT_COLORS[0])
      setEmojiPickerOpen(false)
    } else {
      const item = items.find(it => it.id === id)
      updateRow(i, { item_id: id, item_name: item?.name ?? '' })
      if (newItemRowIdx === i) setNewItemRowIdx(null)
    }
  }

  // ── Inline category creation ──────────────────────────────────────────────────
  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatName.trim()) { toast.error('Category name required'); return }
    setCreatingCat(true)
    try {
      const { data: cat, error } = await supabase
        .from('categories')
        .insert({ name: newCatName.trim(), icon: newCatIcon || '📦', color: newCatColor, ...(orgId ? { org_id: orgId } : {}) })
        .select()
        .single()
      if (error) throw error
      setLocalCategories(prev => [...prev, cat])
      setNewItemCatId(cat.id)
      setShowNewCat(false)
      setNewCatName('')
      setNewCatIcon('📦')
      setNewCatColor(CAT_COLORS[0])
      setEmojiPickerOpen(false)
      toast.success(`"${cat.name}" created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setCreatingCat(false)
    }
  }

  // ── Inline item creation ──────────────────────────────────────────────────────
  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemName.trim()) { toast.error('Item name required'); return }
    if (newItemRowIdx === null) return
    setCreatingItem(true)
    try {
      const { data: newItem, error } = await supabase
        .from('items')
        .insert({ name: newItemName.trim(), category_id: newItemCatId || null, stock: 0, ...(orgId ? { org_id: orgId } : {}) })
        .select('id, name')
        .single()
      if (error) throw error
      setItems(prev => [...prev, newItem])
      updateRow(newItemRowIdx, { item_id: newItem.id, item_name: newItem.name })
      setNewItemRowIdx(null)
      toast.success(`"${newItem.name}" created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create item')
    } finally {
      setCreatingItem(false)
    }
  }

  // ── Confirm log inserts ───────────────────────────────────────────────────────
  const handleConfirm = async () => {
    const valid = updates.filter(u => u.item_id && u.quantity > 0)
    if (!valid.length) { toast.error('Add at least one item'); return }
    setConfirming(true)
    const inserts = valid.map(u => ({
      item_id: u.item_id!,
      direction: u.direction,
      amount: u.quantity,
      comment: `Voice: "${transcript}"`,
      ...(orgId ? { org_id: orgId } : {}),
      ...(u.condition ? { condition: u.condition } : {}),
    }))
    const { error } = await supabase.from('logs').insert(inserts)
    setConfirming(false)
    if (error) { toast.error('Failed to save logs'); return }
    toast.success(`${valid.length} update${valid.length > 1 ? 's' : ''} logged`)
    setStage('idle')
    onLogged?.()
  }

  const cancel = () => {
    mediaRecorderRef.current?.stop()
    setStage('idle')
    setNewItemRowIdx(null)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <>
      {/* FAB */}
      {stage === 'idle' && (
        <button
          onClick={startRecording}
          className={`fixed ${offset} w-14 h-14 bg-primary text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary-dark active:scale-95 transition-all z-20`}
          aria-label="Voice log"
        >
          <Mic className="w-6 h-6" strokeWidth={2} />
        </button>
      )}

      {/* Recording state */}
      {stage === 'recording' && (
        <div className={`fixed ${offset} z-20 flex flex-col items-center gap-2`}>
          <span className="text-xs font-mono text-primary bg-white rounded-full px-2 py-0.5 shadow" style={{ border: '0.5px solid #F0D0DC' }}>
            {fmt(elapsed)}
          </span>
          <button
            onClick={stopRecording}
            className="w-14 h-14 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all animate-pulse"
            aria-label="Stop recording"
          >
            <MicOff className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Processing state */}
      {stage === 'processing' && (
        <div className={`fixed ${offset} z-20 flex flex-col items-center gap-2`}>
          <span className="text-[10px] text-gray-500 bg-white rounded-full px-2 py-0.5 shadow" style={{ border: '0.5px solid #E5E7EB' }}>
            Transcribing…
          </span>
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center shadow">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        </div>
      )}

      {/* Confirmation sheet */}
      {stage === 'confirming' && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={cancel} />
          <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Transcript header */}
            <div className="px-5 pb-3 flex-shrink-0" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
              <div className="flex items-start gap-2">
                <Mic className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500 italic leading-snug">"{transcript}"</p>
              </div>
            </div>

            {/* Update rows (scrollable) */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {updates.map((row, i) => (
                <div key={i} className="space-y-2" style={{ borderBottom: '0.5px solid #F5F5F5', paddingBottom: '14px' }}>
                  {/* Main row: dropdown + qty + in/out + remove */}
                  <div className="flex items-center gap-2">
                    <select
                      value={row.item_id ?? ''}
                      onChange={e => handleItemChange(i, e.target.value)}
                      className="flex-1 min-w-0 px-2 py-2 text-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white appearance-none"
                      style={{ border: `0.5px solid ${row.item_id === null && row.item_name ? '#F0D0DC' : '#E5E7EB'}` }}
                    >
                      <option value="">Pick item…</option>
                      {items.map(it => (
                        <option key={it.id} value={it.id}>{it.name}</option>
                      ))}
                      <option value="__new_item__">＋ Create new item</option>
                    </select>

                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={e => updateRow(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-14 px-2 py-2 text-sm text-center rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                      style={{ border: '0.5px solid #E5E7EB' }}
                    />

                    <button
                      onClick={() => updateRow(i, { direction: row.direction === 'in' ? 'out' : 'in' })}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-colors flex-shrink-0 ${
                        row.direction === 'in' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                      }`}
                      style={{ border: `0.5px solid ${row.direction === 'in' ? '#86EFAC' : '#FCA5A5'}` }}
                    >
                      {row.direction === 'in' ? 'In' : 'Out'}
                    </button>

                    {updates.length > 1 && (
                      <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Proactive "create" chip when AI found a name but no matching item */}
                  {row.item_id === null && row.item_name && newItemRowIdx !== i && (
                    <button
                      onClick={() => handleItemChange(i, '__new_item__')}
                      className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary-light px-2.5 py-1 rounded-lg hover:bg-pink-100 transition-colors"
                      style={{ border: '0.5px solid #F0D0DC' }}
                    >
                      <Plus className="w-3 h-3" />
                      Create "{row.item_name}"
                    </button>
                  )}

                  {/* Inline new-item form */}
                  {newItemRowIdx === i && (
                    <form
                      onSubmit={handleCreateItem}
                      className="mt-1 p-3 rounded-xl space-y-2.5"
                      style={{ border: '0.5px solid #F0D0DC', background: '#FFF5F8' }}
                    >
                      <p className="text-[11px] font-bold text-primary uppercase tracking-wide">New item</p>

                      {/* Item name */}
                      <input
                        type="text"
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        placeholder="Item name"
                        autoFocus
                        className="w-full px-3 py-2 rounded-xl text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                        style={{ border: '0.5px solid #E5E7EB' }}
                      />

                      {/* Category select */}
                      <select
                        value={newItemCatId}
                        onChange={e => {
                          if (e.target.value === '__create_cat__') {
                            setShowNewCat(true)
                          } else {
                            setNewItemCatId(e.target.value)
                            setShowNewCat(false)
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
                        style={{ border: '0.5px solid #E5E7EB' }}
                      >
                        <option value="">— No category —</option>
                        {localCategories.map(c => (
                          <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))}
                        <option value="__create_cat__">＋ Create new category</option>
                      </select>

                      {/* Inline category creation form */}
                      {showNewCat && (
                        <div className="p-2.5 rounded-xl space-y-2" style={{ border: '0.5px solid #E5E7EB', background: 'white' }}>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">New category</p>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEmojiPickerOpen(p => !p)}
                              className="w-10 h-9 rounded-xl text-lg flex items-center justify-center bg-gray-50 flex-shrink-0 hover:bg-gray-100 transition-colors"
                              style={{ border: emojiPickerOpen ? '1.5px solid #D4537E' : '0.5px solid #E5E7EB' }}
                            >
                              {newCatIcon}
                            </button>
                            <input
                              type="text"
                              value={newCatName}
                              onChange={e => setNewCatName(e.target.value)}
                              placeholder="Category name"
                              className="flex-1 px-2.5 py-1.5 rounded-xl text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                              style={{ border: '0.5px solid #E5E7EB' }}
                            />
                          </div>

                          {emojiPickerOpen && (
                            <div className="rounded-xl bg-gray-50 p-2 max-h-28 overflow-y-auto" style={{ border: '0.5px solid #E5E7EB' }}>
                              <div className="grid grid-cols-8 gap-1">
                                {CAT_EMOJIS.map(emoji => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => { setNewCatIcon(emoji); setEmojiPickerOpen(false) }}
                                    className={`text-base p-1 rounded-lg hover:bg-primary-light transition-colors ${newCatIcon === emoji ? 'bg-primary-light' : ''}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-1.5 flex-wrap">
                            {CAT_COLORS.map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setNewCatColor(c)}
                                className="w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                                style={{ backgroundColor: c }}
                              >
                                {newCatColor === c && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                              </button>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowNewCat(false)}
                              className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={e => handleCreateCategory(e as unknown as React.FormEvent)}
                              disabled={creatingCat || !newCatName.trim()}
                              className="flex-1 py-1.5 bg-primary text-white rounded-xl text-xs font-semibold disabled:opacity-40 hover:bg-primary-dark transition-colors"
                            >
                              {creatingCat ? 'Creating…' : 'Create & select'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* New item actions */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewItemRowIdx(null)}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold text-gray-500 bg-white hover:bg-gray-50 transition-colors"
                          style={{ border: '0.5px solid #E5E7EB' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={creatingItem || !newItemName.trim()}
                          className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-semibold disabled:opacity-40 hover:bg-primary-dark transition-colors"
                        >
                          {creatingItem ? 'Creating…' : 'Create & select'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Condition chips */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 mr-0.5">Condition:</span>
                    {CONDITIONS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => updateRow(i, { condition: row.condition === c.value ? null : c.value })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          row.condition === c.value ? c.activeClass : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add another item
              </button>
            </div>

            {/* Actions */}
            <div className="px-5 pb-6 pt-3 flex gap-3 flex-shrink-0" style={{ borderTop: '0.5px solid #F0F0F0' }}>
              <button
                onClick={cancel}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || newItemRowIdx !== null}
                className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:bg-primary-dark transition-colors"
              >
                {confirming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><Check className="w-4 h-4" /> Confirm</>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
