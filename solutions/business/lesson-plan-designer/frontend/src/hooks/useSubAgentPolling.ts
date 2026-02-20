import { useEffect, useRef, useCallback } from 'react'
import type { ActiveSubAgent } from '../types'

interface UseSubAgentPollingOptions {
  sessionId: string
  enabled: boolean  // Poll only when enabled
  onUpdate: (agents: ActiveSubAgent[]) => void
  onError?: (error: Error) => void
}

/**
 * Adaptive polling for active sub-agents
 * - Fast polling (2s) when sub-agents active
 * - Slow polling (10s) when processing but no sub-agents
 * - Stop polling when idle
 */
export function useSubAgentPolling({
  sessionId,
  enabled,
  onUpdate,
  onError,
}: UseSubAgentPollingOptions) {
  const intervalRef = useRef<number | null>(null)
  const activeCountRef = useRef(0)

  const poll = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/sessions/${sessionId}/sub-agents`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const agents = data.activeSubAgents || []

      // Update active count for adaptive interval
      activeCountRef.current = agents.length

      onUpdate(agents)
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }, [sessionId, onUpdate, onError])

  useEffect(() => {
    if (!enabled) {
      // Clear interval when disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Adaptive interval: 2s if active sub-agents, 10s otherwise
    const getInterval = () => {
      return activeCountRef.current > 0 ? 2000 : 10000
    }

    // Initial poll
    poll()

    // Setup interval with re-evaluation after each poll
    const scheduleNext = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      intervalRef.current = window.setInterval(() => {
        poll()
        scheduleNext() // Re-evaluate interval
      }, getInterval())
    }

    scheduleNext()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, poll])
}
