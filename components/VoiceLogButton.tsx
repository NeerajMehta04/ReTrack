'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Check, Plus, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

type Item = { id: string; name: string }

type UpdateRow = {
  item_id: string | null
  item_name: string
  direction: 'in' | 'out'
  quantity: number
}

type Stage = 'idle' | 'recording' | 'processing' | 'confirming'

export default function VoiceLogButton({ onLogged, offset = 'bottom-20 right-4' }: { onLogged?: () => void; offset?: string }) {
  const { org } = useOrg()
  const supabase = createClient()

  const [stage, setStage] = useState<Stage>('idle')
  const [items, setItems] = useState<Item[]>([])
  const [transcript, setTranscript] = useState('')
  const [updates, setUpdates] = useState<UpdateRow[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [confirming, setConfirming] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    supabase
      .from('items')
      .select('id, name')
      .eq('org_id', org.id)
      .is('deleted_at', null)
      .order('name')
      .then(({ data }) => setItems(data ?? []))
  }, [org.id])

  useEffect(() => {
    if (stage === 'recording') {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [stage])

  const processAudio = useCallback(async (blob: Blob) => {
    const fd = new FormData()
    fd.append('audio', blob)
    fd.append('items', JSON.stringify(items.map(i => ({ id: i.id, name: i.name }))))

    const res = await fetch('/api/voice-log', { method: 'POST', body: fd })
    if (!res.ok) {
      toast.error('Could not process voice note')
      setStage('idle')
      return
    }
    const data = await res.json()
    setTranscript(data.transcript ?? '')
    setUpdates(
      data.updates?.length
        ? data.updates
        : [{ item_id: null, item_name: '', direction: 'in' as const, quantity: 1 }]
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

  const addRow = () =>
    setUpdates(u => [...u, { item_id: null, item_name: '', direction: 'in', quantity: 1 }])

  const removeRow = (i: number) =>
    setUpdates(u => u.filter((_, idx) => idx !== i))

  const updateRow = (i: number, patch: Partial<UpdateRow>) =>
    setUpdates(u => u.map((row, idx) => idx === i ? { ...row, ...patch } : row))

  const handleItemChange = (i: number, id: string) => {
    const item = items.find(it => it.id === id)
    updateRow(i, { item_id: id, item_name: item?.name ?? '' })
  }

  const handleConfirm = async () => {
    const valid = updates.filter(u => u.item_id && u.quantity > 0)
    if (!valid.length) { toast.error('Add at least one item'); return }
    setConfirming(true)
    const inserts = valid.map(u => ({
      item_id: u.item_id!,
      direction: u.direction,
      amount: u.quantity,
      comment: `Voice: "${transcript}"`,
      org_id: org.id,
    }))
    const { error } = await supabase.from('logs').insert(inserts)
    setConfirming(false)
    if (error) {
      toast.error('Failed to save logs')
      return
    }
    toast.success(`${valid.length} update${valid.length > 1 ? 's' : ''} logged`)
    setStage('idle')
    onLogged?.()
  }

  const cancel = () => {
    mediaRecorderRef.current?.stop()
    setStage('idle')
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
          <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh]">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex-shrink-0" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
              <div className="flex items-start gap-2">
                <Mic className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500 italic leading-snug">"{transcript}"</p>
              </div>
            </div>

            {/* Update rows (scrollable) */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {updates.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  {/* Item dropdown */}
                  <select
                    value={row.item_id ?? ''}
                    onChange={e => handleItemChange(i, e.target.value)}
                    className="flex-1 min-w-0 px-2 py-2 text-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white appearance-none"
                    style={{ border: '0.5px solid #E5E7EB' }}
                  >
                    <option value="">Pick item…</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>{it.name}</option>
                    ))}
                  </select>

                  {/* Quantity */}
                  <input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={e => updateRow(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-14 px-2 py-2 text-sm text-center rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{ border: '0.5px solid #E5E7EB' }}
                  />

                  {/* In/Out toggle */}
                  <button
                    onClick={() => updateRow(i, { direction: row.direction === 'in' ? 'out' : 'in' })}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-colors flex-shrink-0 ${
                      row.direction === 'in'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-600'
                    }`}
                    style={{ border: `0.5px solid ${row.direction === 'in' ? '#86EFAC' : '#FCA5A5'}` }}
                  >
                    {row.direction === 'in' ? 'In' : 'Out'}
                  </button>

                  {/* Remove row */}
                  {updates.length > 1 && (
                    <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  )}
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
                disabled={confirming}
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
