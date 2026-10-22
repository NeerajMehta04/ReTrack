'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Org layout error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-primary-light flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm text-center" style={{ border: '0.5px solid #F0D0DC' }}>
        <div className="flex justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-base font-bold text-gray-900 mb-1">Something went wrong</h1>
        <p className="text-xs text-gray-500 mb-1">{error.message || 'An unexpected error occurred.'}</p>
        {error.digest && (
          <p className="text-[10px] text-gray-400 font-mono mb-4">ref: {error.digest}</p>
        )}
        <div className="flex flex-col gap-2 mt-4">
          <button
            onClick={reset}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
          >
            Try again
          </button>
          <Link
            href="/items"
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
            style={{ border: '0.5px solid #E5E7EB' }}
          >
            Browse demo
          </Link>
        </div>
      </div>
    </div>
  )
}
