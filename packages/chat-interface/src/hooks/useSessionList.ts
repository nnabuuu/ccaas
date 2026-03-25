import { useState, useEffect, useCallback, useRef } from 'react'
import { buildAuthHeaders } from '@kedge-agentic/react-sdk'
import type { SidebarSession } from '@/components/ChatSidebar'

interface UseSessionListReturn {
  sessions: SidebarSession[]
  isLoading: boolean
  refresh: () => Promise<void>
}

/**
 * Fetch user's session list from the backend.
 * Auto-refreshes on visibilitychange.
 */
export function useSessionList(
  serverUrl: string,
  apiKey?: string,
): UseSessionListReturn {
  const [sessions, setSessions] = useState<SidebarSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (!apiKey) {
      setSessions([])
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    try {
      const url = `${serverUrl}/api/v1/conversations?limit=30`
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { ...buildAuthHeaders(apiKey) },
      })
      if (!res.ok) {
        setSessions([])
        return
      }
      const json = await res.json()
      setSessions(json.conversations ?? [])
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setSessions([])
    } finally {
      setIsLoading(false)
    }
  }, [serverUrl, apiKey])

  // Initial load
  useEffect(() => {
    refresh()
    return () => abortRef.current?.abort()
  }, [refresh])

  // Auto-refresh on tab focus
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refresh])

  return { sessions, isLoading, refresh }
}
