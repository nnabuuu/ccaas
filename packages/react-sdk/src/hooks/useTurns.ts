import { useState, useEffect, useCallback } from 'react'

export interface Turn {
  id: string
  conversationId: string
  turnNumber: number
  userMessageId: string
  assistantMessageId: string
  totalTokens: number
  durationMs: number
  createdAt: string
  completedAt: string
}

export interface UseTurnsOptions {
  serverUrl: string
  conversationId: string
}

export interface UseTurnsReturn {
  turns: Turn[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Hook to fetch and display per-turn metrics (token usage, duration)
 * for a given conversation.
 *
 * TODO: This hook is scaffolded but the backend endpoint is not yet implemented.
 * Current status:
 * - Frontend hook ready ✅
 * - Backend GET /api/v1/conversations/:id/turns endpoint NOT implemented ❌
 * - This hook will return 404 until the backend endpoint is added
 *
 * To complete: Add the endpoint in ConversationsController
 */
export function useTurns(options: UseTurnsOptions): UseTurnsReturn {
  const { serverUrl, conversationId } = options

  const [turns, setTurns] = useState<Turn[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTurns = useCallback(async () => {
    if (!conversationId) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `${serverUrl}/api/v1/conversations/${conversationId}/turns`,
        { method: 'GET' },
      )
      if (!response.ok) {
        setTurns([])
        setError(`Failed to load turns: ${response.status}`)
        return
      }
      const data = await response.json()
      setTurns(data.turns || [])
    } catch (err) {
      setTurns([])
      setError(err instanceof Error ? err.message : 'Failed to load turns')
    } finally {
      setIsLoading(false)
    }
  }, [serverUrl, conversationId])

  useEffect(() => {
    if (conversationId) {
      loadTurns()
    }
  }, [conversationId, loadTurns])

  return { turns, isLoading, error, reload: loadTurns }
}
