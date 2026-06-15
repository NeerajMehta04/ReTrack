'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Item, Log, Category } from '@/types'
import { ArrowLeft, TrendingUp, TrendingDown, Pencil, Trash2, ChevronDown, Search, SlidersHorizontal, RefreshCw, Camera } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import ItemModal from '@/components/items/ItemModal'
import toast from 'react-hot-toast'

type Direction = 'in' | 'out'

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  // ── Data ─────────────────────────────────────────────────────
  const [item, setItem] = useState<Item | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [siblings, setSiblings] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  // ── Switcher sheet ────────────────────────────────────────────
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [switcherSearch, setSwitcherSearch] = useState('')

  // ── Other UI state ────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ── Quick log ─────────────────────────────────────────────────
  const [direction, setDirection] = useState<Direction>('in')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [condition, setCondition] = useState<'good' | 'fair' | 'poor' | ''>('')
  const [logging, setLogging] = useState(false)

  // ── Carbon ────────────────────────────────────────────────────
  const [estimating, setEstimating] = useState(false)
  const [carbonExpanded, setCarbonExpanded] = useState(false)
  const [editingCarbon, setEditingCarbon] = useState(false)
  const [editCarbonKg, setEditCarbonKg] = useState('')
  const [editCarbonSummary, setEditCarbonSummary] = useState('')

  const refreshData = useCallback(async () => {
    const [itemRes, logsRes] = await Promise.all([
      supabase.from('items').select('*, categories(*)').eq('id', id).single(),
      supabase.from('logs').select('*, groups(*)').eq('item_id', id).order('created_at', { ascending: false }),
    ])
    if (itemRes.data) setItem(itemRes.data)
    setLogs(logsRes.data ?? [])
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)

    Promise.all([
      supabase.from('items').select('*, categories(*)').eq('id', id).single(),
      supabase.from('logs').select('*, groups(*)').eq('item_id', id).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ]).then(async ([itemRes, logsRes, catsRes]) => {
      const fetchedItem = itemRes.data
      if (fetchedItem) {
        setItem(fetchedItem)

        const siblingsQuery = fetchedItem.category_id
          ? supabase.from('items').select('id, name, stock, image_url, category_id, description, created_at').eq('category_id', fetchedItem.category_id).is('deleted_at', null).order('name')
          : supabase.from('items').select('id, name, stock, image_url, category_id, description, created_at').is('deleted_at', null).order('name')

        const { data: siblingsData } = await siblingsQuery
        setSiblings(siblingsData ?? [])
      }
      setLogs(logsRes.data ?? [])
      setCategories(catsRes.data ?? [])
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (!switcherOpen) setSwitcherSearch('')
  }, [switcherOpen])

  useEffect(() => {
    const open = switcherOpen || editOpen || confirmDelete
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [switcherOpen, editOpen, confirmDelete])

  async function handleQuickLog() {
    const qty = parseInt(amount)
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return }
    if (direction === 'out' && item && item.stock < qty) {
      toast.error(`Only ${item.stock} in stock`); return
    }
    setLogging(true)
    try {
      const { error } = await supabase.from('logs').insert({
        item_id: id,
        direction,
        amount: qty,
        comment: comment.trim() || null,
        condition: condition || null,
      })
      if (error) throw error
      await refreshData()
      if (item?.carbon_kg_per_item) {
        const { data: fresh } = await supabase
          .from('items').select('stock').eq('id', id).single()
        if (fresh) {
          const newTotal = +(item.carbon_kg_per_item * fresh.stock).toFixed(1)
          await supabase.from('items')
            .update({ carbon_kg_total: newTotal }).eq('id', id)
          setItem(prev => prev ? { ...prev, carbon_kg_total: newTotal, stock: fresh.stock } : prev)
        }
      }
      setSiblings(prev => prev.map(s => s.id === id
        ? { ...s, stock: s.stock + (direction === 'in' ? qty : -qty) }
        : s
      ))
      setAmount('')
      setComment('')
      setCondition('')
      toast.success(direction === 'in' ? `+${qty} logged` : `−${qty} logged`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to log')
    } finally {
      setLogging(false)
    }
  }

  async function handleDelete() {
    if (!item) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('items').update({ deleted_at: new Date().toISOString() }).eq('id', item.id)
      if (error) throw error
      toast.success('Item moved to bin')
      router.push('/items')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !item) return
    try {
      const ext = file.name.split('.').pop()
      const path = `${item.id}.${ext}`
      const { error } = await supabase.storage.from('items').upload(path, file, { upsert: true })
      if (error) throw error
      const imageUrl = supabase.storage.from('items').getPublicUrl(path).data.publicUrl
      await supabase.from('items').update({ image_url: imageUrl }).eq('id', item.id)
      setItem(prev => prev ? { ...prev, image_url: imageUrl } : prev)
      toast.success('Photo updated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  async function handleEstimateCarbon() {
    if (!item?.image_url) return
    setEstimating(true)
    try {
      const res = await fetch('/api/estimate-carbon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: item.image_url, itemName: item.name })
      })
      const data = await res.json()
      const carbonTotal = +(data.carbon_kg_per_item * item.stock).toFixed(1)

      await supabase.from('items').update({
        carbon_kg_per_item: data.carbon_kg_per_item,
        carbon_kg_total: carbonTotal,
        carbon_summary: data.summary
      }).eq('id', item.id)

      setItem(prev => prev ? {
        ...prev,
        carbon_kg_per_item: data.carbon_kg_per_item,
        carbon_kg_total: carbonTotal,
        carbon_summary: data.summary
      } : prev)

      setCarbonExpanded(true)
      toast.success(`~${carbonTotal} kg CO₂ saved!`)
    } catch {
      toast.error('Estimation failed — try again')
    } finally {
      setEstimating(false)
    }
  }

  function startCarbonEdit() {
    setEditCarbonKg(String(item?.carbon_kg_per_item ?? ''))
    setEditCarbonSummary(item?.carbon_summary ?? '')
    setEditingCarbon(true)
    setCarbonExpanded(true)
  }

  async function saveCarbonEdit() {
    if (!item) return
    const perItem = parseFloat(editCarbonKg)
    if (!perItem || perItem <= 0) { toast.error('Enter a valid kg value'); return }
    const newTotal = +(perItem * item.stock).toFixed(1)
    await supabase.from('items').update({
      carbon_kg_per_item: perItem,
      carbon_kg_total: newTotal,
      carbon_summary: editCarbonSummary.trim() || null
    }).eq('id', item.id)
    setItem(prev => prev ? {
      ...prev,
      carbon_kg_per_item: perItem,
      carbon_kg_total: newTotal,
      carbon_summary: editCarbonSummary.trim() || null
    } : prev)
    setEditingCarbon(false)
    toast.success('Carbon data updated')
  }

  // ── Switcher helpers ─────────────────────────────────────────
  const showSearch = siblings.length > 6
  const filteredSiblings = switcherSearch.trim()
    ? siblings.filter(s => s.name.toLowerCase().includes(switcherSearch.toLowerCase()))
    : siblings

  // ── Loading skeleton ─────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
          <Skeleton className="w-20 h-20 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4 rounded-lg" />
            <Skeleton className="h-3 w-1/2 rounded-lg" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!item) return null

  const categoryLabel = item.categories
    ? `${item.categories.icon} ${item.categories.name}`
    : '📦 All Items'

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div
        className="sticky top-0 bg-white z-10 flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '0.5px solid #F0D0DC' }}
      >
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>

        <button
          onClick={() => setSwitcherOpen(true)}
          className="flex items-center gap-1 min-w-0 flex-1"
          style={{
            background: '#FBEAF0',
            color: '#D4537E',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: 600,
            padding: '6px 12px 6px 14px',
            maxWidth: '180px',
          }}
        >
          <span className="truncate">{item.name}</span>
          <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ marginLeft: '4px' }} />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setEditOpen(true)}
            className="w-8 h-8 rounded-xl bg-primary-light flex items-center justify-center hover:bg-pink-200 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-primary" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </div>

      {/* ── Compact info row ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '0.5px solid #F0D0DC' }}>

        <label className="relative w-20 h-20 rounded-xl overflow-hidden bg-primary-light flex items-center justify-center flex-shrink-0 cursor-pointer group">
          {item.image_url ? (
            <Image src={item.image_url} alt={item.name} fill className="object-contain" sizes="80px" />
          ) : (
            <span className="text-3xl">{item.categories?.icon ?? '📦'}</span>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-end p-1">
            <div className="bg-white/80 rounded-full p-0.5">
              <Camera className="w-3 h-3 text-gray-600" />
            </div>
          </div>
          <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
        </label>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{item.name}</h2>
              {item.description && (
                <p className="text-xs text-gray-400 truncate">{item.description}</p>
              )}
              {item.categories && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: item.categories.color }}>
                  {item.categories.icon} {item.categories.name}
                </span>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-3xl font-black text-primary">{item.stock}</span>
              <p className="text-[10px] text-gray-400">in stock</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="p-4 space-y-4 pb-6">

        {/* Quick Log */}
        <div className="bg-white rounded-2xl p-4" style={{ border: '0.5px solid #F0D0DC' }}>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Log Movement</h3>

          <div className="flex gap-1.5 mb-3 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setDirection('in')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                direction === 'in' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              ↑ In (received)
            </button>
            <button
              onClick={() => setDirection('out')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                direction === 'out' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500'
              }`}
            >
              ↓ Out (given away)
            </button>
          </div>

          <div className="flex gap-1.5 mb-3">
            {(['good', 'fair', 'poor'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCondition(prev => prev === c ? '' : c)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  condition === c
                    ? c === 'good' ? 'bg-green-500 text-white shadow-sm'
                    : c === 'fair' ? 'bg-yellow-400 text-white shadow-sm'
                    :                'bg-red-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickLog()}
              placeholder="Qty"
              className="w-[72px] px-3 py-2.5 rounded-xl text-sm text-center font-semibold focus:outline-none focus:ring-1 focus:ring-primary flex-shrink-0"
              style={{ border: '0.5px solid #E5E7EB' }}
            />
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickLog()}
              placeholder="Comment (optional)"
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ border: '0.5px solid #E5E7EB' }}
            />
            <button
              onClick={handleQuickLog}
              disabled={logging || !amount}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40 flex-shrink-0 ${
                direction === 'in' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {logging ? '…' : 'Log'}
            </button>
          </div>
        </div>

        {/* Carbon Footprint card */}
        {(item.carbon_kg_per_item != null || item.image_url) && (
          <div className="bg-green-50 rounded-2xl" style={{ border: '0.5px solid #BBF7D0' }}>
            {item.carbon_kg_per_item != null ? (
              editingCarbon ? (
                <div className="p-4">
                  <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-3">🌱 Carbon Footprint</p>
                  <div className="mb-2">
                    <label className="text-[11px] font-bold text-green-600 uppercase tracking-wide mb-1 block">
                      CO₂ per item (kg)
                    </label>
                    <input
                      type="number"
                      value={editCarbonKg}
                      onChange={e => setEditCarbonKg(e.target.value)}
                      step="0.1"
                      min="0"
                      className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-400 bg-white"
                      style={{ border: '0.5px solid #86EFAC' }}
                      placeholder="e.g. 24.5"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="text-[11px] font-bold text-green-600 uppercase tracking-wide mb-1 block">
                      Notes / summary
                    </label>
                    <textarea
                      value={editCarbonSummary}
                      onChange={e => setEditCarbonSummary(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-400 bg-white resize-none"
                      style={{ border: '0.5px solid #86EFAC' }}
                      placeholder="Description (optional)"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingCarbon(false)}
                      className="flex-1 py-2 rounded-xl text-sm text-green-700 bg-white"
                      style={{ border: '0.5px solid #86EFAC' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveCarbonEdit}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-green-500 hover:bg-green-600"
                    >
                      Save changes
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Collapsed / header row — always visible, tap to toggle */}
                  <div
                    className="flex items-center justify-between cursor-pointer px-4 py-3"
                    onClick={() => setCarbonExpanded(v => !v)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🌱</span>
                      <span className="text-sm font-bold text-green-600">
                        {carbonExpanded ? 'Carbon Footprint' : `${item.carbon_kg_total} kg CO₂ saved`}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-green-500 transition-transform ${carbonExpanded ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Expanded details */}
                  {carbonExpanded && (
                    <div className="px-4 pb-4" style={{ borderTop: '0.5px solid #BBF7D0' }}>
                      <div className="flex items-baseline justify-between pt-3">
                        <div>
                          <span className="text-3xl font-black text-green-600">{item.carbon_kg_total}</span>
                          <span className="text-sm text-green-500 ml-1">kg CO₂ saved total</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-green-600">{item.carbon_kg_per_item} kg</span>
                          <p className="text-[10px] text-green-400">per item</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-green-500 mt-1">Based on {item.stock} in stock</p>
                      {item.carbon_summary && (
                        <p className="text-xs text-green-700 mt-2 leading-relaxed">{item.carbon_summary}</p>
                      )}
                      <div className="mt-3 pt-2.5 flex items-center justify-between"
                        style={{ borderTop: '0.5px solid #BBF7D0' }}>
                        <button
                          onClick={startCarbonEdit}
                          className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Edit values
                        </button>
                        <button
                          onClick={handleEstimateCarbon}
                          disabled={estimating}
                          className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> {estimating ? 'Scanning…' : 'Re-scan'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )
            ) : (
              <div className="p-4">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-3">🌱 Carbon Footprint</p>
                <button
                  onClick={handleEstimateCarbon}
                  disabled={estimating}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors"
                  style={{ border: '0.5px solid #86EFAC' }}
                >
                  {estimating ? 'Analysing photo…' : '✨ Estimate CO₂ saved'}
                </button>
                <p className="text-[10px] text-green-500 text-center mt-1.5">Uses AI to analyse the item photo</p>
              </div>
            )}
          </div>
        )}

        {/* Stock History */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Stock History ({logs.length})
          </h3>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No movements recorded yet</p>
          ) : (
            <div className="space-y-2">
              {logs.map(log => {
                const isCorrection = !!log.comment?.startsWith('Manual correction')
                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 bg-white rounded-xl p-3"
                    style={{ border: '0.5px solid #F0D0DC' }}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCorrection ? 'bg-amber-100'
                      : log.direction === 'in' ? 'bg-green-100'
                      : 'bg-red-100'
                    }`}>
                      {isCorrection
                        ? <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                        : log.direction === 'in'
                        ? <TrendingUp className="w-4 h-4 text-green-600" />
                        : <TrendingDown className="w-4 h-4 text-red-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-bold ${
                          isCorrection ? 'text-amber-600'
                          : log.direction === 'in' ? 'text-green-600'
                          : 'text-red-500'
                        }`}>
                          {log.direction === 'in' ? '+' : '−'}{log.amount}
                        </span>
                        {isCorrection && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 uppercase tracking-wide">
                            Correction
                          </span>
                        )}
                        {log.groups && <span className="text-xs text-gray-500">· {log.groups.name}</span>}
                        {log.condition && !isCorrection && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            log.condition === 'good' ? 'bg-green-100 text-green-700'
                            : log.condition === 'fair' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            {log.condition}
                          </span>
                        )}
                      </div>
                      {log.comment && (
                        <p className={`text-xs truncate mt-0.5 ${isCorrection ? 'text-amber-500' : 'text-gray-400'}`}>
                          {log.comment}
                        </p>
                      )}
                    </div>

                    <time className="text-[10px] text-gray-400 flex-shrink-0 text-right leading-tight">
                      {formatDate(log.created_at)}
                    </time>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Item Switcher Sheet ───────────────────────────────────── */}
      {switcherOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setSwitcherOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: '72vh', animation: 'slideUp 0.25s ease-out' }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="px-5 pt-2 pb-3 flex-shrink-0">
              <p className="text-base font-bold text-gray-900">{categoryLabel}</p>
              <p className="text-xs text-gray-400 mt-0.5">{siblings.length} item{siblings.length !== 1 ? 's' : ''}</p>
            </div>

            {showSearch && (
              <div className="px-5 pb-3 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="search"
                    value={switcherSearch}
                    onChange={e => setSwitcherSearch(e.target.value)}
                    placeholder="Search…"
                    autoFocus
                    className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{ border: '0.5px solid #E5E7EB' }}
                  />
                </div>
              </div>
            )}

            <div style={{ borderTop: '0.5px solid #F0D0DC' }} />

            <div className="overflow-y-auto flex-1">
              {filteredSiblings.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No items found</p>
              ) : (
                filteredSiblings.map((sibling, idx) => {
                  const isCurrent = sibling.id === id
                  return (
                    <button
                      key={sibling.id}
                      onClick={() => {
                        setSwitcherOpen(false)
                        if (!isCurrent) router.replace(`/items/${sibling.id}`)
                      }}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                      style={{
                        borderBottom: idx < filteredSiblings.length - 1 ? '0.5px solid #F5F5F5' : undefined,
                      }}
                    >
                      <div className="w-5 flex-shrink-0 flex items-center justify-center">
                        {isCurrent && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className={`flex-1 text-sm truncate ${
                        isCurrent ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                      }`}>
                        {sibling.name}
                      </span>
                      <span className="text-sm font-semibold text-gray-400 flex-shrink-0">
                        {sibling.stock}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────── */}
      <ItemModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        categories={categories}
        item={item}
        onSaved={(updated, logsRefreshed) => { if (logsRefreshed) refreshData(); else setItem(updated) }}
      />

      {/* ── Delete Confirmation ───────────────────────────────────── */}
      {confirmDelete && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setConfirmDelete(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl p-5 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-1">Delete "{item.name}"?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              This will also delete all associated log entries. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                style={{ border: '0.5px solid #E5E7EB' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
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
