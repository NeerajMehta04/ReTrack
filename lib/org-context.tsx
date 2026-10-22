'use client'

import { createContext, useContext } from 'react'
import type { Organization } from '@/types'

interface OrgContextValue {
  org: Organization
  isAdmin: boolean
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({
  org,
  isAdmin,
  children,
}: OrgContextValue & { children: React.ReactNode }) {
  return (
    <OrgContext.Provider value={{ org, isAdmin }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside OrgProvider')
  return ctx
}
