import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY_JWT = 'edu-jwt'
const STORAGE_KEY_CCAAS = 'edu-ccaas-key'
const STORAGE_KEY_USER = 'edu-user'

/** Solution backend URL */
const SOLUTION_URL = import.meta.env.VITE_SOLUTION_BACKEND_URL || 'http://localhost:3011'

export interface EduUser {
  id: string
  name: string
  username: string
  school: string
}

export interface EduAuth {
  token: string | null
  ccaasApiKey: string | null
  user: EduUser | null
  login: (username: string, password: string) => Promise<void>
  register: (data: { username: string; password: string; name: string; school?: string }) => Promise<void>
  logout: () => void
  isLoading: boolean
  validating: boolean
  error: string | null
}

function loadFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function useEduAuth(): EduAuth {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_JWT))
  const [ccaasApiKey, setCcaasApiKey] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_CCAAS))
  const [user, setUser] = useState<EduUser | null>(() => loadFromStorage<EduUser>(STORAGE_KEY_USER))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validating, setValidating] = useState(() => !!localStorage.getItem(STORAGE_KEY_JWT))

  // Validate stored token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEY_JWT)
    if (!storedToken) {
      setValidating(false)
      return
    }
    fetch(`${SOLUTION_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('invalid')
        return res.json()
      })
      .then(data => {
        setUser(data.user)
        setValidating(false)
      })
      .catch(() => {
        setToken(null)
        setCcaasApiKey(null)
        setUser(null)
        localStorage.removeItem(STORAGE_KEY_JWT)
        localStorage.removeItem(STORAGE_KEY_CCAAS)
        localStorage.removeItem(STORAGE_KEY_USER)
        setValidating(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state → localStorage
  useEffect(() => {
    if (token) localStorage.setItem(STORAGE_KEY_JWT, token)
    else localStorage.removeItem(STORAGE_KEY_JWT)
  }, [token])

  useEffect(() => {
    if (ccaasApiKey) localStorage.setItem(STORAGE_KEY_CCAAS, ccaasApiKey)
    else localStorage.removeItem(STORAGE_KEY_CCAAS)
  }, [ccaasApiKey])

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_KEY_USER)
  }, [user])

  const handleAuthResponse = useCallback(async (res: Response) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: '请求失败' }))
      throw new Error(body.message || `请求失败 (${res.status})`)
    }
    const data = await res.json()
    setToken(data.token)
    setCcaasApiKey(data.ccaasApiKey)
    setUser(data.user)
    setError(null)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${SOLUTION_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      await handleAuthResponse(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setIsLoading(false)
    }
  }, [handleAuthResponse])

  const register = useCallback(async (data: { username: string; password: string; name: string; school?: string }) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${SOLUTION_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      await handleAuthResponse(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '注册失败')
    } finally {
      setIsLoading(false)
    }
  }, [handleAuthResponse])

  const logout = useCallback(() => {
    setToken(null)
    setCcaasApiKey(null)
    setUser(null)
    setError(null)
    localStorage.removeItem(STORAGE_KEY_JWT)
    localStorage.removeItem(STORAGE_KEY_CCAAS)
    localStorage.removeItem(STORAGE_KEY_USER)
  }, [])

  return { token, ccaasApiKey, user, login, register, logout, isLoading, validating, error }
}
