/**
 * useThinking Composable
 *
 * Phase 1.6: Enhanced Event Transparency
 * Provides access to agent thinking/reasoning state.
 */

import { inject, ref, computed, watch } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import {
  IsThinkingKey,
  ThinkingContentKey,
  ThinkingHistoryKey,
  ThinkingIdKey,
} from '../symbols'

/**
 * Return type for useThinking
 */
export interface UseThinkingReturn {
  /** Whether agent is currently thinking */
  isThinking: Readonly<Ref<boolean>>

  /** Current thinking content (streaming) */
  thinkingContent: Readonly<Ref<string>>

  /** History of thinking blocks in this session */
  thinkingHistory: Readonly<Ref<string[]>>

  /** Current thinking block ID */
  thinkingId: Readonly<Ref<string>>

  /** Whether there is any thinking content */
  hasThinking: ComputedRef<boolean>

  /** Length of current thinking content */
  thinkingLength: ComputedRef<number>

  /** Truncated thinking preview (first 200 chars) */
  thinkingPreview: ComputedRef<string>
}

// Default fallback values
const defaultBoolean = ref(false)
const defaultString = ref('')
const defaultStringArray = ref<string[]>([])

/**
 * Thinking composable for extended thinking/reasoning events
 *
 * @example
 * ```vue
 * <script setup>
 * import { useThinking } from '@ccaas/vue-sdk'
 *
 * const { isThinking, thinkingContent, thinkingPreview } = useThinking()
 * </script>
 *
 * <template>
 *   <div v-if="isThinking" class="thinking-indicator">
 *     <span>🧠 Claude is thinking...</span>
 *     <p v-if="thinkingContent">{{ thinkingPreview }}</p>
 *   </div>
 * </template>
 * ```
 */
export function useThinking(): UseThinkingReturn {
  const isThinking = inject(IsThinkingKey, defaultBoolean)
  const thinkingContent = inject(ThinkingContentKey, defaultString)
  const thinkingHistory = inject(ThinkingHistoryKey, defaultStringArray)
  const thinkingId = inject(ThinkingIdKey, defaultString)

  // Computed helpers
  const hasThinking = computed(() => {
    return thinkingContent.value.length > 0 || thinkingHistory.value.length > 0
  })

  const thinkingLength = computed(() => {
    return thinkingContent.value.length
  })

  const thinkingPreview = computed(() => {
    const content = thinkingContent.value
    if (content.length <= 200) return content
    return content.slice(0, 200) + '...'
  })

  return {
    isThinking,
    thinkingContent,
    thinkingHistory,
    thinkingId,
    hasThinking,
    thinkingLength,
    thinkingPreview,
  }
}

export default useThinking
