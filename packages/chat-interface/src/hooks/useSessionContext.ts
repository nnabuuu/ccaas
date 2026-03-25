import { useState, useCallback, useMemo } from 'react'
import type { SessionContext, SessionContextChip } from '@/types/session-context'

interface UseSessionContextOptions {
  initialContext?: SessionContext
  chips?: SessionContextChip[]
}

export function useSessionContext(options: UseSessionContextOptions = {}) {
  const [context, setContext] = useState<SessionContext>(options.initialContext ?? {})
  const [chips, setChips] = useState<SessionContextChip[]>(options.chips ?? [])

  const updateContext = useCallback((key: string, value: unknown) => {
    setContext(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateChip = useCallback((key: string, updates: Partial<SessionContextChip>) => {
    setChips(prev => prev.map(c => c.key === key ? { ...c, ...updates } : c))
  }, [])

  const contextString = useMemo(() => {
    return Object.entries(context)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
  }, [context])

  return {
    context,
    setContext,
    updateContext,
    chips,
    setChips,
    updateChip,
    contextString,
  }
}
