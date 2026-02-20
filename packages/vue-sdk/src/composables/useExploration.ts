/**
 * useExploration Composable
 *
 * Phase 1.6: Enhanced Event Transparency
 * Provides access to exploration activity (Explore/Plan sub-agents).
 */

import { inject, ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import {
  ExplorationActivityKey,
  ExplorationHistoryKey,
} from '../symbols'

/**
 * Current exploration activity
 */
export interface ExplorationActivity {
  action: 'search' | 'read' | 'glob' | 'grep' | 'analyze'
  target: string
  phase: 'start' | 'progress' | 'complete'
  agentType: string
  resultCount?: number
  resultSummary?: string
}

/**
 * Exploration history entry
 */
export interface ExplorationHistoryEntry {
  action: string
  target: string
  resultCount?: number
  resultSummary?: string
  durationMs?: number
  timestamp: string
}

/**
 * Return type for useExploration
 */
export interface UseExplorationReturn {
  /** Current exploration activity */
  exploration: Readonly<Ref<ExplorationActivity | null>>

  /** Exploration history */
  explorationHistory: Readonly<Ref<ExplorationHistoryEntry[]>>

  /** Whether exploration is in progress */
  isExploring: ComputedRef<boolean>

  /** Action icon for current exploration */
  actionIcon: ComputedRef<string>

  /** Action label for current exploration */
  actionLabel: ComputedRef<string>

  /** Total files/matches found in this session */
  totalResultCount: ComputedRef<number>

  /** Number of exploration actions in history */
  explorationCount: ComputedRef<number>
}

// Default fallback values
const defaultExploration = ref<ExplorationActivity | null>(null)
const defaultHistory = ref<ExplorationHistoryEntry[]>([])

// Action icons map
const ACTION_ICONS: Record<string, string> = {
  search: '🔍',
  read: '📖',
  glob: '📁',
  grep: '🔎',
  analyze: '📊',
}

// Action labels map (Chinese)
const ACTION_LABELS: Record<string, string> = {
  search: '搜索中',
  read: '读取文件',
  glob: '查找文件',
  grep: '搜索内容',
  analyze: '分析中',
}

/**
 * Exploration composable for Explore/Plan sub-agent activity
 *
 * @example
 * ```vue
 * <script setup>
 * import { useExploration } from '@kedge-agentic/vue-sdk'
 *
 * const {
 *   exploration,
 *   isExploring,
 *   actionIcon,
 *   actionLabel
 * } = useExploration()
 * </script>
 *
 * <template>
 *   <div v-if="isExploring" class="exploration-progress">
 *     <span class="icon">{{ actionIcon }}</span>
 *     <span class="label">{{ actionLabel }}</span>
 *     <span class="target">{{ exploration.target }}</span>
 *     <span v-if="exploration.resultSummary" class="result">
 *       {{ exploration.resultSummary }}
 *     </span>
 *   </div>
 * </template>
 * ```
 */
export function useExploration(): UseExplorationReturn {
  const exploration = inject(ExplorationActivityKey, defaultExploration)
  const explorationHistory = inject(ExplorationHistoryKey, defaultHistory)

  // Computed helpers
  const isExploring = computed(() => {
    return exploration.value !== null &&
      (exploration.value.phase === 'start' || exploration.value.phase === 'progress')
  })

  const actionIcon = computed(() => {
    const action = exploration.value?.action || 'search'
    return ACTION_ICONS[action] || '⚙️'
  })

  const actionLabel = computed(() => {
    const action = exploration.value?.action || 'search'
    return ACTION_LABELS[action] || '处理中'
  })

  const totalResultCount = computed(() => {
    return explorationHistory.value.reduce((sum, entry) => {
      return sum + (entry.resultCount || 0)
    }, 0)
  })

  const explorationCount = computed(() => {
    return explorationHistory.value.length
  })

  return {
    exploration,
    explorationHistory,
    isExploring,
    actionIcon,
    actionLabel,
    totalResultCount,
    explorationCount,
  }
}

export default useExploration
