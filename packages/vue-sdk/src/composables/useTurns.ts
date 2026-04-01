/**
 * useTurns Composable
 *
 * Per-turn metrics for a given conversation/session.
 * Fetches GET /api/v1/sessions/:id/turns.
 *
 * Ported from @kedge-agentic/react-sdk useTurns hook.
 */

import { ref, watch } from 'vue'
import type { Ref } from 'vue'

// ============================================================================
// Types (defined inline per requirements)
// ============================================================================

/**
 * A single conversation turn with metrics
 */
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

/**
 * Composable options
 */
export interface UseTurnsOptions {
  /** Backend server URL */
  serverUrl: string

  /** Conversation ID to fetch turns for */
  conversationId: Ref<string>
}

/**
 * Composable return value
 */
export interface UseTurnsReturn {
  /** List of turns with metrics */
  turns: Readonly<Ref<Turn[]>>

  /** Whether turns are currently being fetched */
  isLoading: Readonly<Ref<boolean>>

  /** Error message if fetch failed */
  error: Readonly<Ref<string | null>>

  /** Manually reload turns from the API */
  reload: () => Promise<void>
}

/**
 * Turns composable for fetching per-turn metrics of a conversation.
 *
 * @example
 * ```vue
 * <script setup>
 * import { ref } from 'vue'
 * import { useTurns } from '@kedge-agentic/vue-sdk'
 *
 * const conversationId = ref('conv-abc-123')
 * const { turns, isLoading, error, reload } = useTurns({
 *   serverUrl: 'http://localhost:3001',
 *   conversationId,
 * })
 * </script>
 *
 * <template>
 *   <div v-if="isLoading">Loading turns...</div>
 *   <div v-else-if="error">{{ error }}</div>
 *   <ul v-else>
 *     <li v-for="turn in turns" :key="turn.id">
 *       Turn {{ turn.turnNumber }}: {{ turn.totalTokens }} tokens, {{ turn.durationMs }}ms
 *     </li>
 *   </ul>
 * </template>
 * ```
 */
export function useTurns(options: UseTurnsOptions): UseTurnsReturn {
  const { serverUrl, conversationId } = options

  const turns = ref<Turn[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadTurns(): Promise<void> {
    if (!conversationId.value) return

    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(
        `${serverUrl}/api/v1/sessions/${conversationId.value}/turns`,
        { method: 'GET' },
      )

      if (!response.ok) {
        turns.value = []
        error.value = `Failed to load turns: ${response.status}`
        return
      }

      const data = await response.json()
      turns.value = data.turns || []
    } catch (err) {
      turns.value = []
      error.value = err instanceof Error ? err.message : 'Failed to load turns'
    } finally {
      isLoading.value = false
    }
  }

  // Auto-load when conversationId changes
  watch(conversationId, (newId) => {
    if (newId) {
      loadTurns()
    }
  }, { immediate: true })

  return {
    turns,
    isLoading,
    error,
    reload: loadTurns,
  }
}

export default useTurns
