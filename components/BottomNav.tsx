'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, Grid3X3, ClipboardList, Leaf, Trash2 } from 'lucide-react'

const TABS = [
  { href: '/items',      label: 'Items',      Icon: Package },
  { href: '/categories', label: 'Categories', Icon: Grid3X3 },
  { href: '/logs',       label: 'Logs',       Icon: ClipboardList },
  { href: '/carbon',     label: 'Carbon',     Icon: Leaf },
  { href: '/bin',        label: 'Bin',        Icon: Trash2 },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white max-w-md mx-auto z-10"
      style={{ borderTop: '0.5px solid #F0D0DC' }}
    >
      <div className="flex pb-safe">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{ color: active ? '#D4537E' : '#9CA3AF' }}
            >
              <Icon
                className="w-[22px] h-[22px]"
                strokeWidth={active ? 2.5 : 1.5}
              />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
