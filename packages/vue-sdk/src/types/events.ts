/**
 * Socket.io Event Types
 *
 * Common event types for the CCAAS platform.
 * Business-specific protocols (e.g., lesson plans) should be handled by consumers.
 */

import type { TodoItem, ToolActivity, ReasoningPhase } from './agent-state'
import type { PageContext } from './connection'

// =============================================================================
// Output Update Protocol - Generic types for structured output events
// =============================================================================

// Re-use OutputProgress from agent-state to avoid duplication
import type { OutputProgress } from './agent-state'
export type { OutputProgress }

/**
 * Generation status values (generic)
 */
export type OutputStatus = 'idle' | 'generating' | 'completed' | 'error'

/**
 * Generic Output Update Event - Socket.io event from backend to frontend
 *
 * This is the platform-agnostic version. Business domains (e.g., lesson plans)
 * should define their own typed versions extending this interface.
 *
 * @example
 * ```typescript
 * const event: OutputUpdateEvent = {
 *   data: { someField: {...} },
 *   status: 'generating',
 *   progress: { totalSteps: 7, completedSteps: 1, percentage: 14 },
 *   timestamp: '2024-01-15T10:30:00.000Z',
 * }
 * ```
 */
export interface OutputUpdateEvent<TData = Record<string, unknown>> {
  /** Generated content fields */
  data: TData
  /** Generation status */
  status: OutputStatus
  /** Optional progress tracking */
  progress?: OutputProgress
  /** ISO 8601 timestamp */
  timestamp: string
  /** Parent session ID (identifies the main agent session) */
  parentSessionId?: string
  /** Sub-agent type that generated this output */
  agentType?: string
  /** Full sub-agent session ID */
  subAgentSessionId?: string
  /** Run sequence number (1-based) */
  runSeq?: number
  /** Total number of runs */
  totalRuns?: number
}

// =============================================================================
// Core Socket Events
// =============================================================================

/**
 * Base event interface
 */
export interface BaseSocketEvent {
  type: string
  sessionId?: string
  timestamp?: string
}

/**
 * Client ID event (sent on connection)
 */
export interface ClientIdEvent {
  type: 'client_id'
  clientId: string
}

/**
 * Agent status event
 */
export interface AgentStatusEvent extends BaseSocketEvent {
  type: 'agent_status'
  status: 'idle' | 'running' | 'complete' | 'error'
  skillId?: string
  error?: string
  exitCode?: number
}

/**
 * Text delta event (streaming text)
 */
export interface TextDeltaEvent extends BaseSocketEvent {
  type: 'text_delta'
  delta: string
  isStreaming?: boolean
}

/**
 * Tool activity event
 */
export interface ToolActivityEvent extends BaseSocketEvent {
  type: 'tool_activity'
  payload: {
    toolCallId: string
    toolName: string
    phase: 'start' | 'progress' | 'complete' | 'error'
    description: string
    input?: unknown
    output?: unknown
    durationMs?: number
    success?: boolean
    agentType?: string
    decisionLogic?: {
      why: string
      benefit: string
      nextStep?: string
    }
  }
}

/**
 * Todo update event
 */
export interface TodoUpdateEvent extends BaseSocketEvent {
  type: 'todo_update'
  payload: {
    todos: TodoItem[]
    currentTaskIndex?: number
    completedCount: number
    inProgressCount?: number
    pendingCount?: number
    totalCount: number
    agentType?: string
  }
}

/**
 * Session restored event
 */
export interface SessionRestoredEvent extends BaseSocketEvent {
  type: 'session_restored'
  status: string
  messageCount: number
  createdAt: string
}

/**
 * Session not found event
 */
export interface SessionNotFoundEvent extends BaseSocketEvent {
  type: 'session_not_found'
}

/**
 * Stats event
 */
export interface StatsEvent {
  type: 'stats'
  totalSessions: number
  idleSessions: number
  processingSessions: number
  maxSessions: number
}

/**
 * Plan proposal event
 */
export interface PlanProposalEvent extends BaseSocketEvent {
  type: 'plan_proposal'
  payload: {
    traceId: string
    sections: Array<{
      id: string
      name: string
      description?: string
      isEmpty?: boolean
    }>
    context?: Record<string, unknown>
  }
}

/**
 * Command result event
 */
export interface CommandResultEvent extends BaseSocketEvent {
  type: 'command_result'
  commandId: string
  success: boolean
  error?: string
  result?: unknown
}

/**
 * Union of all socket events
 */
export type SocketEvent =
  | ClientIdEvent
  | AgentStatusEvent
  | TextDeltaEvent
  | ToolActivityEvent
  | TodoUpdateEvent
  | SessionRestoredEvent
  | SessionNotFoundEvent
  | StatsEvent
  | PlanProposalEvent
  | CommandResultEvent

/**
 * Event type string
 */
export type SocketEventType = SocketEvent['type']

/**
 * Skill chat request
 */
export interface SkillChatRequest {
  skillId: string
  message: string
  context?: PageContext
  sessionId?: string
}

/**
 * Chat message (for skill_chat event)
 */
export interface SkillChatPayload {
  apiKey?: string
  request: SkillChatRequest
}

// =============================================================================
// Phase 1.6: Enhanced Event Transparency
// =============================================================================

/**
 * Agent thinking event - extended thinking/reasoning
 */
export interface AgentThinkingEvent extends BaseSocketEvent {
  type: 'agent_thinking'
  payload: {
    phase: 'start' | 'delta' | 'end'
    content?: string
    thinkingId: string
  }
}

/**
 * Exploration activity event - tracks Explore/Plan agent activity
 */
export interface ExplorationActivityEvent extends BaseSocketEvent {
  type: 'exploration_activity'
  payload: {
    action: 'search' | 'read' | 'glob' | 'grep' | 'analyze'
    target: string
    agentType: string
    parentToolCallId?: string
    phase: 'start' | 'progress' | 'complete'
    resultCount?: number
    resultSummary?: string
    durationMs?: number
  }
}

/**
 * Token usage event - real-time token metrics
 */
export interface TokenUsageEvent extends BaseSocketEvent {
  type: 'token_usage'
  payload: {
    inputTokens: number
    outputTokens: number
    reasoningTokens?: number
    cachedInputTokens?: number
    sessionTotalTokens: number
    sessionInputTokens: number
    sessionOutputTokens: number
    estimatedCostUsd?: number
    model: string
    stopReason: string
    messageId: string
  }
}

/**
 * Enhanced agent status event with detailed context
 */
export interface EnhancedAgentStatusEvent extends BaseSocketEvent {
  type: 'agent_status'
  status: 'idle' | 'thinking' | 'exploring' | 'executing' | 'complete' | 'error'
  context?: {
    currentAction?: string
    currentTarget?: string
    stepsCompleted?: number
    stepsTotal?: number
    percentComplete?: number
    activeSubAgent?: {
      type: string
      status: string
      startedAt: string
    }
    goalNarrative?: {
      title?: string
      subject?: string
      chapter?: string
      edition?: string
    }
  }
  error?: {
    code: string
    message: string
    recoverable: boolean
    suggestion?: string
  }
}

/**
 * Add new events to union type
 */
export type EnhancedSocketEvent =
  | SocketEvent
  | AgentThinkingEvent
  | ExplorationActivityEvent
  | TokenUsageEvent
  | EnhancedAgentStatusEvent
