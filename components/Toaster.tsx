'use client'

import { Toaster as HotToaster } from 'react-hot-toast'

export default function Toaster() {
  return (
    <HotToaster
      position="top-center"
      toastOptions={{
        style: {
          borderRadius: '12px',
          background: '#1F2937',
          color: '#fff',
          fontSize: '13px',
          fontWeight: '500',
        },
        success: {
          style: { background: '#D4537E' },
          iconTheme: { primary: '#fff', secondary: '#D4537E' },
        },
        error: {
          style: { background: '#EF4444' },
          iconTheme: { primary: '#fff', secondary: '#EF4444' },
        },
        duration: 2500,
      }}
    />
  )
}
