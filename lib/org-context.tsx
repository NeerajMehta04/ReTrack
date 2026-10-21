'use client'

import { createContext, useContext } from 'react'
import type { Organization } from '@/types'

interface OrgContextValue {
  org: Organization
  isAdmin: boolean
}

export const OrgContext = createContext<OrgContextValue | null>(null)

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside OrgContext.Provider')
  return ctx
}
