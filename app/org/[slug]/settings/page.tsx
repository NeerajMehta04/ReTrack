'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import type { OrgMember } from '@/types'
import { UserPlus, Trash2, ArrowLeft, Check, LogOut, MoreHorizontal, Shield, ShieldOff, User, Building2, Plus } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatRelativeTime } from '@/lib/utils'

type ActionTarget = OrgMember | null

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
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [actionTarget, setActionTarget] = useState<ActionTarget>(null)
  const [working, setWorking] = useState(false)

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
      if (user?.user_metadata?.first_name) setFirstName(user.user_metadata.first_name)
      if (user?.user_metadata?.last_name) setLastName(user.user_metadata.last_name)
    })
  }, [fetchMembers])

  useEffect(() => {
    document.body.style.overflow = actionTarget ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [actionTarget])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    })
    if (error) toast.error('Failed to update profile')
    else toast.success('Profile updated')
    setSavingProfile(false)
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) return
    setSavingName(true)
    const { error } = await supabase
      .from('organizations')
      .update({ name: orgName.trim() })
      .eq('id', org.id)
    if (error) toast.error('Failed to update name')
    else toast.success('Name updated')
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
      if (error.code === '23505') toast.error('That email is already a member')
      else toast.error('Failed to add member')
    } else {
      toast.success(`${email} added`)
      setNewEmail('')
      fetchMembers()
    }
    setAddingMember(false)
  }

  async function toggleRole(member: OrgMember) {
    setWorking(true)
    const newRole = member.role === 'admin' ? 'member' : 'admin'
    const { error } = await supabase
      .from('org_members')
      .update({ role: newRole })
      .eq('id', member.id)
    if (error) toast.error('Failed to update role')
    else toast.success(newRole === 'admin' ? `${member.email} is now an admin` : `${member.email} is now a member`)
    setActionTarget(null)
    setWorking(false)
    fetchMembers()
  }

  async function removeMember(member: OrgMember) {
    setWorking(true)
    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('id', member.id)
    if (error) toast.error('Failed to remove member')
    else toast.success(`${member.email} removed`)
    setActionTarget(null)
    setWorking(false)
    fetchMembers()
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-4 pt-5 pb-3" style={{ borderBottom: '0.5px solid #F0D0DC' }}>
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
        {/* Account — all members */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Account</h2>
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white mb-3"
            style={{ border: '0.5px solid #E5E7EB' }}
          >
            <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm text-gray-700 truncate">{currentEmail}</p>
          </div>
          <form onSubmit={saveProfile} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ border: '0.5px solid #E5E7EB' }}
              />
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
                className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ border: '0.5px solid #E5E7EB' }}
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary-dark transition-colors"
            >
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </section>

        {/* Organisation name — admin only */}
        {isAdmin && (
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
              Workspace URL: <span className="font-mono text-gray-500">/org/{org.slug}</span>
            </p>
          </section>
        )}

        {/* Members — admin only */}
        {isAdmin && (
          <section>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Members</h2>
              <span className="text-[10px] text-gray-400">{members.length} {members.length === 1 ? 'person' : 'people'}</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Only these email addresses can access this workspace.
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
                  <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {members.map(member => {
                  const isSelf = member.email === currentEmail
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between px-3 py-3 rounded-xl bg-white"
                      style={{ border: '0.5px solid #E5E7EB' }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-800 truncate">{member.email}</p>
                            {isSelf && <span className="text-[10px] text-gray-400">(you)</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              member.role === 'admin'
                                ? 'bg-primary-light text-primary'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {member.role === 'admin' && <Shield className="w-2.5 h-2.5" />}
                              {member.role === 'admin' ? 'Admin' : 'Member'}
                            </span>
                            <span className="text-[10px] text-gray-400">· Added {formatRelativeTime(member.added_at)}</span>
                          </div>
                        </div>
                      </div>
                      {!isSelf && (
                        <button
                          onClick={() => setActionTarget(member)}
                          className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors ml-2"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
                {members.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No members yet</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Workspace actions — all members */}
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

        {/* Sign out — all members */}
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

      {/* Member action sheet */}
      {actionTarget && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setActionTarget(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white rounded-t-2xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Member info */}
            <div className="px-5 py-3" style={{ borderBottom: '0.5px solid #F5F5F5' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{actionTarget.email}</p>
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${
                    actionTarget.role === 'admin' ? 'bg-primary-light text-primary' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {actionTarget.role === 'admin' && <Shield className="w-2.5 h-2.5" />}
                    {actionTarget.role === 'admin' ? 'Admin' : 'Member'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-3 space-y-1">
              <button
                onClick={() => toggleRole(actionTarget)}
                disabled={working}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
              >
                {actionTarget.role === 'admin'
                  ? <ShieldOff className="w-5 h-5 text-gray-500" />
                  : <Shield className="w-5 h-5 text-primary" />
                }
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {actionTarget.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {actionTarget.role === 'admin'
                      ? 'Downgrade to regular member'
                      : 'Grant access to settings and member management'}
                  </p>
                </div>
              </button>

              <button
                onClick={() => removeMember(actionTarget)}
                disabled={working}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 transition-colors text-left disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-sm font-semibold text-red-500">Remove from workspace</p>
                  <p className="text-[11px] text-gray-400">They will lose access immediately</p>
                </div>
              </button>
            </div>

            <div className="px-5 pb-6 pt-1">
              <button
                onClick={() => setActionTarget(null)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
