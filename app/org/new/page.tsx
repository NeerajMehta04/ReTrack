'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Toaster } from 'react-hot-toast'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}

export default function NewOrgPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function handleNameChange(value: string) {
    setName(value)
    if (!slugEdited) setSlug(toSlug(value))
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true)
    setSlug(toSlug(value))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) {
      toast.error('Name and slug are required')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Not signed in'); return }

      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: name.trim(), slug: slug.trim(), owner_id: user.id })
        .select()
        .single()

      if (orgErr) {
        if (orgErr.code === '23505') {
          if (orgErr.message.includes('organizations_owner_name_unique') || orgErr.message.includes('owner_name')) {
            toast.error('You already have a workspace with this name')
          } else {
            toast.error('That workspace URL is already taken — try a different one')
          }
        } else {
          toast.error(orgErr.message || 'Failed to create organisation')
          console.error('Org create error:', orgErr)
        }
        setSaving(false)
        return
      }

      // Add creator as admin member
      const { error: memberErr } = await supabase.from('org_members').insert({
        org_id: org.id,
        email: user.email!,
        role: 'admin',
      })

      if (memberErr) {
        console.error('Member insert error:', memberErr)
        toast.error(`Org created but could not add you as member: ${memberErr.message}`)
        setSaving(false)
        return
      }

      toast.success('Organisation created!')
      router.push(`/org/${org.slug}/settings`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to create organisation'
      console.error('Create org error:', err)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary-light flex items-center justify-center p-4">
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px' } }} />

      <div className="w-full max-w-sm">
        {/* Back link */}
        <Link
          href="/items"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to demo
        </Link>

        {/* Logo + title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/30">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your workspace</h1>
          <p className="text-sm text-gray-500 mt-1">Set up ReTrack for your organisation</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm" style={{ border: '0.5px solid #F0D0DC' }}>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Org name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Organisation name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                required
                autoFocus
                placeholder="Warwick Upcycle Society"
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                style={{ border: '0.5px solid #E5E7EB' }}
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Workspace URL
              </label>
              <div
                className="flex items-center rounded-xl overflow-hidden"
                style={{ border: '0.5px solid #E5E7EB' }}
              >
                <span className="px-3 py-2.5 bg-gray-50 text-xs text-gray-400 border-r border-gray-100 whitespace-nowrap">
                  retrack.app/org/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  required
                  placeholder="warwick-upcycle"
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Letters, numbers and hyphens only. Cannot be changed later.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || !slug}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 mt-2"
            >
              {saving ? 'Creating…' : 'Create workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
