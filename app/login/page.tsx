'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { Package, Eye, EyeOff, AlertCircle, ArrowLeft, ChevronRight } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  otp_expired:   'Your sign-in link has expired. Please sign in with your password.',
  access_denied: 'Sign-in was denied. Please try again.',
  no_code:       'Invalid sign-in link. Please sign in with your password.',
  auth_error:    'Something went wrong. Please try again.',
}

type View = 'landing' | 'signin' | 'signup'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorKey = searchParams.get('error')
  const errorMessage = errorKey ? (ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.auth_error) : null

  const [view, setView] = useState<View>('landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function routeAfterSignIn(userEmail: string) {
    const { data: memberships } = await supabase
      .from('org_members')
      .select('org_id, organizations(slug)')
      .eq('email', userEmail)

    if (!memberships || memberships.length === 0) {
      router.push('/org/setup')
      return
    }
    if (memberships.length === 1) {
      const raw = memberships[0].organizations as unknown
      const slug = Array.isArray(raw)
        ? (raw[0] as { slug: string })?.slug
        : (raw as { slug: string } | null)?.slug
      if (slug) { router.push(`/org/${slug}/items`); return }
    }
    router.push('/org/choose')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (view === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        await routeAfterSignIn(data.user.email ?? email)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user && !data.user.identities?.length) {
          throw new Error('An account with this email already exists. Please sign in instead.')
        }
        toast.success('Account created!')
        await routeAfterSignIn(data.user?.email ?? email)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Error banner */}
      {errorMessage && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '0.5px solid #F0D0DC' }}>
        {/* Brand header */}
        <div className="px-6 pt-8 pb-6 text-center" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-md shadow-primary/25">
            <Package className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">ReTrack</h1>
          <p className="text-sm text-gray-400 mt-1">Giving items a second life</p>
        </div>

        {/* Actions */}
        <div className="px-6 py-6">
          {view === 'landing' && (
            <div className="space-y-3">
              <button
                onClick={() => setView('signin')}
                className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20"
              >
                Sign in
              </button>
              <button
                onClick={() => setView('signup')}
                className="w-full py-3 rounded-xl font-semibold text-sm text-primary hover:bg-primary-light transition-colors"
                style={{ border: '0.5px solid #D4537E' }}
              >
                Create account
              </button>

              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] text-gray-400">or explore first</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <button
                onClick={() => router.push('/items')}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-primary hover:bg-primary-light transition-colors"
              >
                Browse demo
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {(view === 'signin' || view === 'signup') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => { setView('landing'); setEmail(''); setPassword('') }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>

              <p className="text-sm font-semibold text-gray-800">
                {view === 'signin' ? 'Welcome back' : 'Create your account'}
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  style={{ border: '0.5px solid #E5E7EB' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    style={{ border: '0.5px solid #E5E7EB' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {view === 'signup' && (
                  <p className="text-[10px] text-gray-400 mt-1">Minimum 6 characters</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20"
              >
                {loading
                  ? (view === 'signin' ? 'Signing in…' : 'Creating account…')
                  : (view === 'signin' ? 'Sign in' : 'Create account')}
              </button>

              <p className="text-center text-xs text-gray-400">
                {view === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => { setView(view === 'signin' ? 'signup' : 'signin'); setPassword('') }}
                  className="text-primary font-semibold hover:underline"
                >
                  {view === 'signin' ? 'Create one' : 'Sign in'}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-primary-light flex items-center justify-center p-4">
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px' } }} />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
