'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, Grid3X3, ClipboardList, Leaf, Trash2, Settings, LogIn, LogOut } from 'lucide-react'

const BASE_TABS = [
  { path: '/items',      label: 'Items',      Icon: Package },
  { path: '/categories', label: 'Categories', Icon: Grid3X3 },
  { path: '/logs',       label: 'Logs',       Icon: ClipboardList },
  { path: '/carbon',     label: 'Carbon',     Icon: Leaf },
  { path: '/bin',        label: 'Bin',        Icon: Trash2 },
]

interface Props {
  basePath?: string
  showSettings?: boolean
}

export default function BottomNav({ basePath = '', showSettings = false }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    if (basePath !== '') return // org nav doesn't need this
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session))
  }, [basePath])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tabs = [
    ...BASE_TABS.map(t => ({ ...t, href: basePath + t.path })),
    ...(showSettings ? [{ path: '/settings', href: basePath + '/settings', label: 'Settings', Icon: Settings }] : []),
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white max-w-md mx-auto z-10"
      style={{ borderTop: '0.5px solid #F0D0DC' }}
    >
      <div className="flex pb-safe">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{ color: active ? '#D4537E' : '#9CA3AF' }}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}

        {/* Sign in / Sign out tab — demo nav only */}
        {basePath === '' && hasSession !== null && (
          hasSession ? (
            <button
              onClick={handleSignOut}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{ color: '#9CA3AF' }}
            >
              <LogOut className="w-[22px] h-[22px]" strokeWidth={1.5} />
              <span className="text-[10px] font-medium">Sign out</span>
            </button>
          ) : (
            <Link
              href="/login"
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{ color: pathname === '/login' ? '#D4537E' : '#9CA3AF' }}
            >
              <LogIn className="w-[22px] h-[22px]" strokeWidth={1.5} />
              <span className="text-[10px] font-medium">Sign in</span>
            </Link>
          )
        )}
      </div>
    </nav>
  )
}
