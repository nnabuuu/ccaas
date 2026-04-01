import { useState, useEffect, useCallback, useRef } from 'react'
import { buildAuthHeaders } from '@kedge-agentic/react-sdk'
import type { SidebarSession } from '@/components/ChatSidebar'

interface UseSessionListReturn {
  sessions: SidebarSession[]
  isLoading: boolean
  refresh: () => Promise<void>
}

/** Polling interval when no sessions exist (aggressive to catch first conversation) */
const EMPTY_POLL_MS = 5_000
/** Polling interval when sessions exist (relaxed) */
const ACTIVE_POLL_MS = 30_000

/**
 * Fetch user's session list from the backend.
 * Auto-refreshes on visibilitychange and polls periodically.
 */
export function useSessionList(
  serverUrl: string,
  apiKey?: string,
  tenantId?: string,
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
      const url = `${serverUrl}/api/v1/sessions?limit=30`
      const headers: Record<string, string> = {}
      if (apiKey) {
        Object.assign(headers, buildAuthHeaders(apiKey))
      }
      if (tenantId) {
        headers['X-Tenant-Id'] = tenantId
      }
      const res = await fetch(url, {
        signal: controller.signal,
        headers,
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
  }, [serverUrl, apiKey, tenantId])

  // Initial load
  useEffect(() => {
    refresh()
    return () => abortRef.current?.abort()
  }, [refresh])

  // Periodic polling — faster when sidebar is empty (to catch first conversation)
  useEffect(() => {
    const interval = sessions.length === 0 ? EMPTY_POLL_MS : ACTIVE_POLL_MS
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }, interval)
    return () => clearInterval(timer)
  }, [refresh, sessions.length])

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
