'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { Package, Mail } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + '/categories',
        },
      })
      if (error) throw error
      setSent(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary-light flex items-center justify-center p-4">
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px' } }} />

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/30">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ReTrack</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to manage your organisation's stock</p>
        </div>

        {/* Card */}
        <div
          className="bg-white rounded-2xl p-6 shadow-sm"
          style={{ border: '0.5px solid #F0D0DC' }}
        >
          {sent ? (
            /* ── Confirmation state ── */
            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-light mb-4">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Check your email</h2>
              <p className="text-sm text-gray-500 mb-5">
                We sent a magic link to <span className="font-semibold text-gray-700">{email}</span>. Tap it to sign in.
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-xs text-primary font-semibold hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            /* ── Email form ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="you@university.edu"
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  style={{ border: '0.5px solid #E5E7EB' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20"
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
