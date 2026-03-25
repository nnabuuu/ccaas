import { useState, useCallback } from 'react'
import { getUrlParam } from '@/utils/url'

const STORAGE_KEY = 'ck-api-key'

export interface UseAuthReturn {
  apiKey: string | undefined
  login: (key: string) => void
  logout: () => void
}

/**
 * Manages API key authentication.
 * Priority: URL param `apiKey` (embed mode) > localStorage (persisted login).
 *
 * Note: key is stored in localStorage for persistence across page reloads.
 * In high-security contexts, consider exchanging the key for a server-side session token.
 */
export function useAuth(): UseAuthReturn {
  // Read URL key once on first render; strip from URL to prevent leakage via Referer/history
  const [urlKey] = useState<string | null>(() => {
    const key = getUrlParam('apiKey')
    if (key) {
      const url = new URL(window.location.href)
      url.searchParams.delete('apiKey')
      window.history.replaceState({}, '', url.toString())
    }
    return key
  })

  const [storedKey, setStoredKey] = useState<string | undefined>(() => {
    if (urlKey) return undefined // URL param takes precedence
    return localStorage.getItem(STORAGE_KEY) ?? undefined
  })

  const apiKey = urlKey ?? storedKey

  const login = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEY, key)
    setStoredKey(key)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setStoredKey(undefined)
  }, [])

  return { apiKey, login, logout }
}
