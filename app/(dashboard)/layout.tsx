export const dynamic = 'force-dynamic'

import BottomNav from '@/components/BottomNav'
import Toaster from '@/components/Toaster'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-white max-w-md mx-auto" style={{ boxShadow: '0 0 0 0.5px #F0D0DC' }}>
      <main className="pb-16 min-h-screen">{children}</main>
      <BottomNav />
      <Toaster />
    </div>
  )
}
