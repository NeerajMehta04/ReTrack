'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import type { OrgMember } from '@/types'
import { UserPlus, Trash2, ArrowLeft, Check, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'

export default function OrgSettingsPage() {
  const { org, isAdmin } = useOrg()
  const router = useRouter()
  const supabase = createClient()

  const [orgName, setOrgName] = useState(org.name)
  const [savingName, setSavingName] = useState(false)

  const [members, setMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [currentEmail, setCurrentEmail] = useState('')

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true)
    const { data } = await supabase
      .from('org_members')
      .select('*')
      .eq('org_id', org.id)
      .order('added_at', { ascending: true })
    setMembers((data ?? []) as OrgMember[])
    setLoadingMembers(false)
  }, [org.id])

  useEffect(() => {
    fetchMembers()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setCurrentEmail(user.email)
    })
  }, [fetchMembers])

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) return
    setSavingName(true)
    const { error } = await supabase
      .from('organizations')
      .update({ name: orgName.trim() })
      .eq('id', org.id)
    if (error) {
      toast.error('Failed to update name')
    } else {
      toast.success('Name updated')
    }
    setSavingName(false)
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    setAddingMember(true)
    const { error } = await supabase
      .from('org_members')
      .insert({ org_id: org.id, email, role: 'member' })
    if (error) {
      if (error.code === '23505') {
        toast.error('That email is already a member')
      } else {
        toast.error('Failed to add member')
      }
    } else {
      toast.success(`${email} added`)
      setNewEmail('')
      fetchMembers()
    }
    setAddingMember(false)
  }

  async function removeMember(member: OrgMember) {
    if (member.email === currentEmail) {
      toast.error("You can't remove yourself")
      return
    }
    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('id', member.id)
    if (error) {
      toast.error('Failed to remove member')
    } else {
      toast.success(`${member.email} removed`)
      fetchMembers()
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center p-8 text-center">
        <p className="text-gray-500 text-sm">Only admins can access settings.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div
        className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3"
        style={{ borderBottom: '0.5px solid #F0D0DC' }}
      >
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Settings</h1>
        </div>
        <p className="text-xs text-gray-400 ml-11">{org.name}</p>
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* Organisation name */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Organisation</h2>
          <form onSubmit={saveName} className="flex gap-2">
            <input
              type="text"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ border: '0.5px solid #E5E7EB' }}
            />
            <button
              type="submit"
              disabled={savingName || orgName.trim() === org.name}
              className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary-dark transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
          </form>
          <p className="text-[10px] text-gray-400 mt-1.5">
            Workspace URL: <span className="font-mono text-gray-500">/org/{org.slug}</span> (cannot be changed)
          </p>
        </section>

        {/* Members */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Members</h2>
          <p className="text-xs text-gray-400 mb-3">
            Only these email addresses can access this workspace after signing in.
          </p>

          {/* Add member */}
          <form onSubmit={addMember} className="flex gap-2 mb-4">
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="new@organisation.edu"
              className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ border: '0.5px solid #E5E7EB' }}
            />
            <button
              type="submit"
              disabled={addingMember || !newEmail.trim()}
              className="px-3 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary-dark transition-colors flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add
            </button>
          </form>

          {/* Member list */}
          {loadingMembers ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {members.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50"
                  style={{ border: '0.5px solid #E5E7EB' }}
                >
                  <div>
                    <p className="text-sm text-gray-800 font-medium">{member.email}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{member.role}</p>
                  </div>
                  {member.email !== currentEmail && (
                    <button
                      onClick={() => removeMember(member)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No members yet</p>
              )}
            </div>
          )}
        </section>

        {/* Sign out */}
        <section>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
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
