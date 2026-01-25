/**
 * useToolActivity Composable
 *
 * Provides tool activity tracking with computed helpers.
 */

import { inject, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import {
  CurrentToolActivityKey,
  ToolActivityHistoryKey,
  CurrentToolNameKey,
  CurrentToolDurationKey,
} from '../symbols'
import type { ToolActivity } from '../types/agent-state'

/**
 * Return type for useToolActivity
 */
export interface UseToolActivityReturn {
  /** Current tool activity */
  current: Readonly<Ref<ToolActivity | null>>
  /** Tool activity history */
  history: Readonly<Ref<ToolActivity[]>>
  /** Current tool name */
  toolName: Readonly<Ref<string>>
  /** Current tool duration in ms */
  duration: Readonly<Ref<number>>
  /** Whether a tool is currently running */
  isRunning: ComputedRef<boolean>
  /** Whether the last tool succeeded */
  lastSucceeded: ComputedRef<boolean | null>
  /** Current decision logic */
  decisionLogic: ComputedRef<{
    why: string
    benefit: string
    nextStep?: string
  } | null>
  /** Recent tool activities (last N) */
  recentActivities: (count?: number) => ToolActivity[]
  /** Get tool activity by ID */
  getById: (toolId: string) => ToolActivity | undefined
}

// Default fallback values
const defaultToolActivity = { value: null as ToolActivity | null }
const defaultToolActivityHistory = { value: [] as ToolActivity[] }
const defaultString = { value: '' }
const defaultNumber = { value: 0 }

/**
 * Tool activity composable
 *
 * @example
 * ```vue
 * <script setup>
 * import { useToolActivity } from '@ccaas/vue-sdk'
 *
 * const { current, isRunning, decisionLogic, recentActivities } = useToolActivity()
 * </script>
 *
 * <template>
 *   <div v-if="isRunning" class="tool-running">
 *     <span>{{ current?.description }}</span>
 *     <span v-if="decisionLogic">
 *       Why: {{ decisionLogic.why }}
 *     </span>
 *   </div>
 *   <ul>
 *     <li v-for="activity in recentActivities(5)" :key="activity.toolId">
 *       {{ activity.toolName }} - {{ activity.description }}
 *     </li>
 *   </ul>
 * </template>
 * ```
 */
export function useToolActivity(): UseToolActivityReturn {
  // Inject values
  const current = inject(CurrentToolActivityKey, defaultToolActivity as Ref<ToolActivity | null>)
  const history = inject(ToolActivityHistoryKey, defaultToolActivityHistory as Ref<ToolActivity[]>)
  const toolName = inject(CurrentToolNameKey, defaultString as Ref<string>)
  const duration = inject(CurrentToolDurationKey, defaultNumber as Ref<number>)

  // Computed values
  const isRunning = computed(() => {
    return current.value?.phase === 'start' || current.value?.phase === 'progress'
  })

  const lastSucceeded = computed(() => {
    if (!current.value || current.value.phase === 'start' || current.value.phase === 'progress') {
      return null
    }
    return current.value.success ?? null
  })

  const decisionLogic = computed(() => {
    return current.value?.decisionLogic || null
  })

  /**
   * Get recent tool activities
   */
  function recentActivities(count = 10): ToolActivity[] {
    return history.value.slice(-count)
  }

  /**
   * Get tool activity by ID
   */
  function getById(toolId: string): ToolActivity | undefined {
    return history.value.find((a) => a.toolId === toolId)
  }

  return {
    current,
    history,
    toolName,
    duration,
    isRunning,
    lastSucceeded,
    decisionLogic,
    recentActivities,
    getById,
  }
}

export default useToolActivity
