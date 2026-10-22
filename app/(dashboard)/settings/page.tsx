'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, Plus, LogOut, User, Pencil } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function DemoSettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [savedFirstName, setSavedFirstName] = useState('')
  const [savedLastName, setSavedLastName] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email)
      const fn = user?.user_metadata?.first_name ?? ''
      const ln = user?.user_metadata?.last_name ?? ''
      setFirstName(fn); setSavedFirstName(fn)
      setLastName(ln); setSavedLastName(ln)
    })
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    })
    if (error) {
      toast.error('Failed to update profile')
    } else {
      setSavedFirstName(firstName.trim())
      setSavedLastName(lastName.trim())
      setEditingProfile(false)
      toast.success('Profile updated')
    }
    setSavingProfile(false)
  }

  function cancelEditProfile() {
    setFirstName(savedFirstName)
    setLastName(savedLastName)
    setEditingProfile(false)
  }

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
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Account</h2>
          {email && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white mb-3"
              style={{ border: '0.5px solid #E5E7EB' }}
            >
              <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm text-gray-700 truncate">{email}</p>
            </div>
          )}
          {editingProfile ? (
            <form onSubmit={saveProfile} className="space-y-2">
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ border: '0.5px solid #E5E7EB' }}
              />
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ border: '0.5px solid #E5E7EB' }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelEditProfile}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary-dark transition-colors"
                >
                  {savingProfile ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <div
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-white"
              style={{ border: '0.5px solid #E5E7EB' }}
            >
              <p className="text-sm text-gray-700">
                {savedFirstName || savedLastName
                  ? `${savedFirstName} ${savedLastName}`.trim()
                  : <span className="text-gray-400">Add your name</span>
                }
              </p>
              <button
                onClick={() => setEditingProfile(true)}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            </div>
          )}
        </section>

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
