'use client'

import { Package, Plus, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function OrgSetupPage() {
  return (
    <div className="min-h-screen bg-primary-light flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo + greeting */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/30">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to ReTrack</h1>
          <p className="text-sm text-gray-500 mt-1">What would you like to do?</p>
        </div>

        <div className="space-y-3">
          <Link
            href="/org/new"
            className="flex items-center justify-between w-full bg-primary text-white px-5 py-4 rounded-2xl font-semibold text-sm hover:bg-primary-dark transition-colors shadow-md shadow-primary/25"
          >
            <div className="flex items-center gap-3">
              <Plus className="w-5 h-5" />
              <div className="text-left">
                <p className="font-bold">Create your workspace</p>
                <p className="text-[11px] text-white/70 font-normal mt-0.5">Set up a private org inventory</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-70" />
          </Link>

          <Link
            href="/items"
            className="flex items-center justify-between w-full bg-white px-5 py-4 rounded-2xl font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            style={{ border: '0.5px solid #F0D0DC' }}
          >
            <div className="text-left">
              <p className="font-bold text-gray-800">Browse the demo</p>
              <p className="text-[11px] text-gray-400 font-normal mt-0.5">Explore ReTrack without a workspace</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
        </div>
      </div>
    </div>
  )
}
