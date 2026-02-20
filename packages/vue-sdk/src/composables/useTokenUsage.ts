/**
 * useTokenUsage Composable
 *
 * Phase 1.6: Enhanced Event Transparency
 * Provides access to real-time token usage metrics.
 */

import { inject, ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import {
  TokenUsageKey,
  SessionTokensKey,
  CurrentModelKey,
  EstimatedCostKey,
} from '../symbols'
import type { TokenUsage } from '../types/agent-state'

/**
 * Session token totals
 */
export interface SessionTokens {
  input: number
  output: number
  cached: number
  reasoning: number
  total: number
}

/**
 * Return type for useTokenUsage
 */
export interface UseTokenUsageReturn {
  /** Current request token usage */
  tokenUsage: Readonly<Ref<TokenUsage>>

  /** Session cumulative token totals */
  sessionTokens: Readonly<Ref<SessionTokens>>

  /** Current model being used */
  currentModel: Readonly<Ref<string>>

  /** Estimated cost in USD */
  estimatedCost: Readonly<Ref<number>>

  /** Total tokens (current request) */
  totalTokens: ComputedRef<number>

  /** Session total tokens */
  sessionTotalTokens: ComputedRef<number>

  /** Formatted token count (e.g., "1.2K") */
  formattedTotalTokens: ComputedRef<string>

  /** Formatted session tokens */
  formattedSessionTokens: ComputedRef<string>

  /** Formatted cost (e.g., "$0.12") */
  formattedCost: ComputedRef<string>

  /** Whether there's any token usage */
  hasUsage: ComputedRef<boolean>

  /** Cache hit rate percentage */
  cacheHitRate: ComputedRef<number>
}

// Default fallback values
const defaultTokenUsage = ref<TokenUsage>({ input: 0, output: 0, total: 0 })
const defaultSessionTokens = ref<SessionTokens>({
  input: 0,
  output: 0,
  cached: 0,
  reasoning: 0,
  total: 0,
})
const defaultString = ref('')
const defaultNumber = ref(0)

/**
 * Format number with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  return num.toString()
}

/**
 * Token usage composable for real-time metrics
 *
 * @example
 * ```vue
 * <script setup>
 * import { useTokenUsage } from '@kedge-agentic/vue-sdk'
 *
 * const {
 *   tokenUsage,
 *   sessionTokens,
 *   formattedTotalTokens,
 *   formattedCost
 * } = useTokenUsage()
 * </script>
 *
 * <template>
 *   <div class="token-usage">
 *     <div class="stat">
 *       <span class="label">输入</span>
 *       <span class="value">{{ tokenUsage.input }}</span>
 *     </div>
 *     <div class="stat">
 *       <span class="label">输出</span>
 *       <span class="value">{{ tokenUsage.output }}</span>
 *     </div>
 *     <div class="stat total">
 *       <span class="label">总计</span>
 *       <span class="value">{{ formattedTotalTokens }}</span>
 *     </div>
 *     <div v-if="estimatedCost > 0" class="stat cost">
 *       <span class="label">费用</span>
 *       <span class="value">{{ formattedCost }}</span>
 *     </div>
 *   </div>
 * </template>
 * ```
 */
export function useTokenUsage(): UseTokenUsageReturn {
  const tokenUsage = inject(TokenUsageKey, defaultTokenUsage)
  const sessionTokens = inject(SessionTokensKey, defaultSessionTokens)
  const currentModel = inject(CurrentModelKey, defaultString)
  const estimatedCost = inject(EstimatedCostKey, defaultNumber)

  // Computed helpers
  const totalTokens = computed(() => {
    return tokenUsage.value.total || (tokenUsage.value.input + tokenUsage.value.output)
  })

  const sessionTotalTokens = computed(() => {
    return sessionTokens.value.total ||
      (sessionTokens.value.input + sessionTokens.value.output + sessionTokens.value.reasoning)
  })

  const formattedTotalTokens = computed(() => {
    return formatNumber(totalTokens.value)
  })

  const formattedSessionTokens = computed(() => {
    return formatNumber(sessionTotalTokens.value)
  })

  const formattedCost = computed(() => {
    const cost = estimatedCost.value
    if (cost <= 0) return '$0.00'
    if (cost < 0.01) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(2)}`
  })

  const hasUsage = computed(() => {
    return totalTokens.value > 0 || sessionTotalTokens.value > 0
  })

  const cacheHitRate = computed(() => {
    const totalInput = sessionTokens.value.input + sessionTokens.value.cached
    if (totalInput === 0) return 0
    return Math.round((sessionTokens.value.cached / totalInput) * 100)
  })

  return {
    tokenUsage,
    sessionTokens,
    currentModel,
    estimatedCost,
    totalTokens,
    sessionTotalTokens,
    formattedTotalTokens,
    formattedSessionTokens,
    formattedCost,
    hasUsage,
    cacheHitRate,
  }
}

export default useTokenUsage
