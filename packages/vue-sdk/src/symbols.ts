/**
 * Injection Symbols
 *
 * Type-safe injection keys for Vue's provide/inject pattern.
 * These symbols are used by AgentListener to provide values to child components.
 */

import type { InjectionKey, Ref } from 'vue'
import type {
  TodoItem,
  ToolActivity,
  OutputProgress,
  TokenUsage,
  GoalNarrative,
  ReasoningPhase,
} from './types/agent-state'
import type {
  AgentFormHandlers,
  RegisterAgentForm,
  UnregisterAgentForm,
} from './types/form-bridge'
import type { PlanProposal } from './types/plan-proposal'
import type { ConnectionState } from './types/connection'

// === Connection Symbols ===

/** Client ID from server */
export const AgentClientIdKey: InjectionKey<Ref<string>> = Symbol('agentClientId')

/** Current session ID */
export const AgentSessionIdKey: InjectionKey<Ref<string>> = Symbol('agentSessionId')

/** Whether connected to server */
export const AgentConnectedKey: InjectionKey<Ref<boolean>> = Symbol('agentConnected')

/** Full connection state */
export const ConnectionStateKey: InjectionKey<Ref<ConnectionState>> = Symbol('connectionState')

// === Processing Status Symbols ===

/** Whether agent is currently processing */
export const IsAgentProcessingKey: InjectionKey<Ref<boolean>> = Symbol('isAgentProcessing')

/** Current tool being executed */
export const CurrentToolNameKey: InjectionKey<Ref<string>> = Symbol('currentToolName')

/** Current skill being used */
export const CurrentSkillNameKey: InjectionKey<Ref<string>> = Symbol('currentSkillName')

/** Current sub-agent type */
export const CurrentAgentTypeKey: InjectionKey<Ref<string>> = Symbol('currentAgentType')

/** Tool execution duration in ms */
export const CurrentToolDurationKey: InjectionKey<Ref<number>> = Symbol('currentToolDuration')

/** Tool input parameters (sanitized) */
export const CurrentToolInputKey: InjectionKey<Ref<unknown>> = Symbol('currentToolInput')

/** Streaming text from agent */
export const StreamingTextKey: InjectionKey<Ref<string>> = Symbol('streamingText')

// === Tool Activity Symbols ===

/** Current tool activity */
export const CurrentToolActivityKey: InjectionKey<Ref<ToolActivity | null>> = Symbol('currentToolActivity')

/** Tool activity history */
export const ToolActivityHistoryKey: InjectionKey<Ref<ToolActivity[]>> = Symbol('toolActivityHistory')

// === Todo Symbols ===

/** Todo items from agent */
export const TodoItemsKey: InjectionKey<Ref<TodoItem[]>> = Symbol('todoItems')

/** Sub-agent todo items */
export const SubagentTodosKey: InjectionKey<Ref<TodoItem[]>> = Symbol('subagentTodos')

/** Todo statistics */
export const TodoStatsKey: InjectionKey<Ref<{
  completed: number
  inProgress: number
  pending: number
  total: number
}>> = Symbol('todoStats')

// === Reasoning Symbols ===

/** Current reasoning phase */
export const ReasoningPhaseKey: InjectionKey<Ref<ReasoningPhase>> = Symbol('reasoningPhase')

/** Reasoning summary text */
export const ReasoningSummaryKey: InjectionKey<Ref<string>> = Symbol('reasoningSummary')

/** Reasoning history for current request */
export const ReasoningHistoryKey: InjectionKey<Ref<unknown[]>> = Symbol('reasoningHistory')

// === Output Generation Symbols ===

/** Whether AI is generating output */
export const AiOutputGeneratingKey: InjectionKey<Ref<boolean>> = Symbol('aiOutputGenerating')
/** Alias for AIOutputGeneratingKey with alternate casing */
export const AIOutputGeneratingKey = AiOutputGeneratingKey

/** AI output generation progress */
export const AiOutputProgressKey: InjectionKey<Ref<OutputProgress>> = Symbol('aiOutputProgress')
/** Alias for AIOutputProgressKey with alternate casing */
export const AIOutputProgressKey = AiOutputProgressKey

// === Plan Mode Symbols ===

/** Pending plan proposal */
export const PendingPlanProposalKey: InjectionKey<Ref<PlanProposal | null>> = Symbol('pendingPlanProposal')

/** Function to confirm plan proposal */
export const ConfirmPlanProposalKey: InjectionKey<() => void> = Symbol('confirmPlanProposal')

/** Function to reject plan proposal */
export const RejectPlanProposalKey: InjectionKey<() => void> = Symbol('rejectPlanProposal')

// === Metrics Symbols ===

/** Session start timestamp */
export const SessionStartedAtKey: InjectionKey<Ref<string | null>> = Symbol('sessionStartedAt')

/** Elapsed time in seconds */
export const ElapsedSecondsKey: InjectionKey<Ref<number>> = Symbol('elapsedSeconds')

/** Token usage metrics */
export const TokenUsageKey: InjectionKey<Ref<TokenUsage>> = Symbol('tokenUsage')

// === Run Tracking Symbols ===

/** Current run sequence number */
export const CurrentRunSeqKey: InjectionKey<Ref<number | undefined>> = Symbol('currentRunSeq')

/** Total agent runs */
export const TotalAgentRunsKey: InjectionKey<Ref<number | undefined>> = Symbol('totalAgentRuns')

/** Run history */
export const RunHistoryKey: InjectionKey<Ref<unknown[]>> = Symbol('runHistory')

// === Goal Narrative Symbols ===

/** Goal narrative for display */
export const GoalNarrativeKey: InjectionKey<Ref<GoalNarrative>> = Symbol('goalNarrative')

// === Form Bridge Symbols ===

/** Register a form with the agent */
export const RegisterAgentFormKey: InjectionKey<RegisterAgentForm> = Symbol('registerAgentForm')

/** Unregister a form from the agent */
export const UnregisterAgentFormKey: InjectionKey<UnregisterAgentForm> = Symbol('unregisterAgentForm')

/** Currently active form ID */
export const ActiveFormIdKey: InjectionKey<Ref<string | null>> = Symbol('activeFormId')

// === Utility Symbols ===

/** Function to reset agent processing state */
export const ResetAgentProcessingKey: InjectionKey<() => void> = Symbol('resetAgentProcessing')

/** Whether a message has been sent in this session */
export const HasMessageSentInSessionKey: InjectionKey<Ref<boolean>> = Symbol('hasMessageSentInSession')

/** Function to mark message as sent */
export const MarkMessageSentKey: InjectionKey<() => void> = Symbol('markMessageSent')

/** Selection mode */
export const SelectionModeKey: InjectionKey<Ref<'none' | 'page' | 'chatbox'>> = Symbol('selectionMode')

/** Agent auth ready status */
export const AgentAuthReadyKey: InjectionKey<Ref<boolean>> = Symbol('agentAuthReady')

// === Thinking/Reasoning Symbols (Phase 1.6) ===

/** Whether agent is currently thinking */
export const IsThinkingKey: InjectionKey<Ref<boolean>> = Symbol('isThinking')

/** Current thinking content */
export const ThinkingContentKey: InjectionKey<Ref<string>> = Symbol('thinkingContent')

/** Thinking history for current session */
export const ThinkingHistoryKey: InjectionKey<Ref<string[]>> = Symbol('thinkingHistory')

/** Current thinking block ID */
export const ThinkingIdKey: InjectionKey<Ref<string>> = Symbol('thinkingId')

// === Exploration Symbols (Phase 1.6) ===

/** Current exploration activity */
export const ExplorationActivityKey: InjectionKey<Ref<{
  action: 'search' | 'read' | 'glob' | 'grep' | 'analyze'
  target: string
  phase: 'start' | 'progress' | 'complete'
  agentType: string
  resultCount?: number
  resultSummary?: string
} | null>> = Symbol('explorationActivity')

/** Exploration history */
export const ExplorationHistoryKey: InjectionKey<Ref<Array<{
  action: string
  target: string
  resultCount?: number
  resultSummary?: string
  durationMs?: number
  timestamp: string
}>>> = Symbol('explorationHistory')

// === Enhanced Token Usage Symbols (Phase 1.6) ===

/** Session token totals */
export const SessionTokensKey: InjectionKey<Ref<{
  input: number
  output: number
  cached: number
  reasoning: number
  total: number
}>> = Symbol('sessionTokens')

/** Current model being used */
export const CurrentModelKey: InjectionKey<Ref<string>> = Symbol('currentModel')

/** Estimated cost in USD */
export const EstimatedCostKey: InjectionKey<Ref<number>> = Symbol('estimatedCost')
