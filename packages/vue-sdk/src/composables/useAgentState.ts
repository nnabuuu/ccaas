/**
 * useAgentState Composable
 *
 * Provides access to centralized agent state via inject.
 * Use this in child components to access agent state without prop drilling.
 */

import { inject, ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import {
  AgentClientIdKey,
  AgentSessionIdKey,
  AgentConnectedKey,
  IsAgentProcessingKey,
  CurrentToolNameKey,
  CurrentSkillNameKey,
  CurrentAgentTypeKey,
  CurrentToolDurationKey,
  CurrentToolActivityKey,
  ToolActivityHistoryKey,
  TodoItemsKey,
  SubagentTodosKey,
  TodoStatsKey,
  ReasoningPhaseKey,
  ReasoningSummaryKey,
  AiOutputGeneratingKey,
  AiOutputProgressKey,
  TokenUsageKey,
  ElapsedSecondsKey,
  CurrentRunSeqKey,
  TotalAgentRunsKey,
  GoalNarrativeKey,
  StreamingTextKey,
} from '../symbols'
import type {
  TodoItem,
  ToolActivity,
  OutputProgress,
  TokenUsage,
  GoalNarrative,
  ReasoningPhase,
} from '../types/agent-state'

/**
 * Return type for useAgentState
 */
export interface UseAgentStateReturn {
  // Connection
  clientId: Readonly<Ref<string>>
  sessionId: Readonly<Ref<string>>
  isConnected: Readonly<Ref<boolean>>

  // Processing
  isProcessing: Readonly<Ref<boolean>>
  currentToolName: Readonly<Ref<string>>
  currentSkillName: Readonly<Ref<string>>
  currentAgentType: Readonly<Ref<string>>
  currentToolDuration: Readonly<Ref<number>>
  streamingText: Readonly<Ref<string>>

  // Tool activity
  currentToolActivity: Readonly<Ref<ToolActivity | null>>
  toolActivityHistory: Readonly<Ref<ToolActivity[]>>

  // Todos
  todoItems: Readonly<Ref<TodoItem[]>>
  subagentTodos: Readonly<Ref<TodoItem[]>>
  todoStats: Readonly<Ref<{
    completed: number
    inProgress: number
    pending: number
    total: number
  }>>

  // Reasoning
  reasoningPhase: Readonly<Ref<ReasoningPhase>>
  reasoningSummary: Readonly<Ref<string>>

  // Output generation
  aiOutputGenerating: Readonly<Ref<boolean>>
  aiOutputProgress: Readonly<Ref<OutputProgress>>

  // Metrics
  tokenUsage: Readonly<Ref<TokenUsage>>
  elapsedSeconds: Readonly<Ref<number>>

  // Run tracking
  currentRunSeq: Readonly<Ref<number | undefined>>
  totalAgentRuns: Readonly<Ref<number | undefined>>

  // Goal narrative
  goalNarrative: Readonly<Ref<GoalNarrative>>

  // Computed helpers
  hasActiveTodo: ComputedRef<boolean>
  isAnyToolRunning: ComputedRef<boolean>
  currentActivity: ComputedRef<string>
}

// Default fallback values
const defaultString = ref('')
const defaultNumber = ref(0)
const defaultBoolean = ref(false)
const defaultToolActivity = ref<ToolActivity | null>(null)
const defaultToolActivityHistory = ref<ToolActivity[]>([])
const defaultTodoItems = ref<TodoItem[]>([])
const defaultTodoStats = ref({ completed: 0, inProgress: 0, pending: 0, total: 0 })
const defaultOutputProgress = ref<OutputProgress>({ totalSteps: 0, completedSteps: 0, percentage: 0 })
const defaultTokenUsage = ref<TokenUsage>({ input: 0, output: 0, total: 0 })
const defaultGoalNarrative = ref<GoalNarrative>({ title: '', subject: '', chapter: '', edition: '' })
const defaultUndefined = ref<number | undefined>(undefined)

/**
 * Agent state composable
 *
 * @example
 * ```vue
 * <script setup>
 * import { useAgentState } from '@kedge-agentic/vue-sdk'
 *
 * const {
 *   isProcessing,
 *   currentToolName,
 *   todoItems
 * } = useAgentState()
 * </script>
 *
 * <template>
 *   <div v-if="isProcessing">
 *     Processing: {{ currentToolName }}
 *   </div>
 *   <ul>
 *     <li v-for="todo in todoItems" :key="todo.content">
 *       {{ todo.content }} - {{ todo.status }}
 *     </li>
 *   </ul>
 * </template>
 * ```
 */
export function useAgentState(): UseAgentStateReturn {
  // Inject all state values
  const clientId = inject(AgentClientIdKey, defaultString)
  const sessionId = inject(AgentSessionIdKey, defaultString)
  const isConnected = inject(AgentConnectedKey, defaultBoolean)
  const isProcessing = inject(IsAgentProcessingKey, defaultBoolean)
  const currentToolName = inject(CurrentToolNameKey, defaultString)
  const currentSkillName = inject(CurrentSkillNameKey, defaultString)
  const currentAgentType = inject(CurrentAgentTypeKey, defaultString)
  const currentToolDuration = inject(CurrentToolDurationKey, defaultNumber)
  const streamingText = inject(StreamingTextKey, defaultString)
  const currentToolActivity = inject(CurrentToolActivityKey, defaultToolActivity)
  const toolActivityHistory = inject(ToolActivityHistoryKey, defaultToolActivityHistory)
  const todoItems = inject(TodoItemsKey, defaultTodoItems)
  const subagentTodos = inject(SubagentTodosKey, defaultTodoItems)
  const todoStats = inject(TodoStatsKey, defaultTodoStats)
  const reasoningPhase = inject(ReasoningPhaseKey, ref<ReasoningPhase>(''))
  const reasoningSummary = inject(ReasoningSummaryKey, defaultString)
  const aiOutputGenerating = inject(AiOutputGeneratingKey, defaultBoolean)
  const aiOutputProgress = inject(AiOutputProgressKey, defaultOutputProgress)
  const tokenUsage = inject(TokenUsageKey, defaultTokenUsage)
  const elapsedSeconds = inject(ElapsedSecondsKey, defaultNumber)
  const currentRunSeq = inject(CurrentRunSeqKey, defaultUndefined)
  const totalAgentRuns = inject(TotalAgentRunsKey, defaultUndefined)
  const goalNarrative = inject(GoalNarrativeKey, defaultGoalNarrative)

  // Computed helpers
  const hasActiveTodo = computed(() => {
    return todoItems.value.some((t) => t.status === 'in_progress')
  })

  const isAnyToolRunning = computed(() => {
    return currentToolActivity.value?.phase === 'start' ||
      currentToolActivity.value?.phase === 'progress'
  })

  const currentActivity = computed(() => {
    const activeTodo = todoItems.value.find(t => t.status === 'in_progress')
    if (activeTodo?.activeForm) return activeTodo.activeForm

    if (currentToolActivity.value?.phase === 'start' && currentToolActivity.value?.description) {
      return currentToolActivity.value.description
    }

    if (reasoningPhase.value === 'analyzing') return '思考中...'
    return ''
  })

  return {
    clientId,
    sessionId,
    isConnected,
    isProcessing,
    currentToolName,
    currentSkillName,
    currentAgentType,
    currentToolDuration,
    streamingText,
    currentToolActivity,
    toolActivityHistory,
    todoItems,
    subagentTodos,
    todoStats,
    reasoningPhase,
    reasoningSummary,
    aiOutputGenerating,
    aiOutputProgress,
    tokenUsage,
    elapsedSeconds,
    currentRunSeq,
    totalAgentRuns,
    goalNarrative,
    hasActiveTodo,
    isAnyToolRunning,
    currentActivity,
  }
}

export default useAgentState
