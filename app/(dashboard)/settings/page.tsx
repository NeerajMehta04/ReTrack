'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, Plus, LogOut, User } from 'lucide-react'
import Link from 'next/link'

export default function DemoSettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email)
    })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
        <p className="text-[10px] text-gray-400 mt-0.5">Demo workspace</p>
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* Account */}
        {email && (
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Account</h2>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white"
              style={{ border: '0.5px solid #E5E7EB' }}
            >
              <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm text-gray-700 truncate">{email}</p>
            </div>
          </section>
        )}

        {/* Workspace */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Workspace</h2>
          <div className="space-y-2">
            <Link
              href="/org/choose"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-gray-50 transition-colors"
              style={{ border: '0.5px solid #E5E7EB' }}
            >
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Switch workspace</span>
            </Link>
            <Link
              href="/org/new"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-gray-50 transition-colors"
              style={{ border: '0.5px solid #E5E7EB' }}
            >
              <Plus className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Create new workspace</span>
            </Link>
          </div>
        </section>

        {/* Sign out */}
        <section>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
            style={{ border: '0.5px solid #FCA5A5' }}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </section>
      </div>
    </div>
  )
}
