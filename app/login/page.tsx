'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { Package, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/items')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
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
          <h1 className="text-2xl font-bold text-gray-900">Upcycle Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to manage your organisation's stock</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl p-6 shadow-sm"
          style={{ border: '0.5px solid #F0D0DC' }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                style={{ border: '0.5px solid #E5E7EB' }}
                placeholder="org@university.edu"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                  style={{ border: '0.5px solid #E5E7EB' }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
