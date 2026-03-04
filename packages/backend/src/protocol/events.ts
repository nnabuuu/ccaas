/**
 * Enhanced Event Protocol
 *
 * Event types for frontend-backend communication.
 * Includes thinking, exploration, token usage, and tool activity events.
 */

// ============================================================================
// Base Event Interface
// ============================================================================

export interface BaseEvent {
  type: string;
  sessionId: string;
  timestamp: string;
}

// ============================================================================
// Agent Thinking Events (Extended Thinking/Reasoning)
// ============================================================================

/**
 * Agent thinking event - forward extended thinking from Claude SDK
 */
export interface AgentThinkingEvent extends BaseEvent {
  type: 'agent_thinking';
  payload: {
    /** Phase of thinking: start, delta (content update), end */
    phase: 'start' | 'delta' | 'end';
    /** Thinking text content (for delta phase) */
    content?: string;
    /** Unique ID for this thinking block */
    thinkingId: string;
  };
}

// ============================================================================
// Exploration Activity Events (Explore/Plan Sub-agents)
// ============================================================================

/**
 * Exploration activity event - track what Explore agent is doing
 */
export interface ExplorationActivityEvent extends BaseEvent {
  type: 'exploration_activity';
  payload: {
    /** Type of exploration action */
    action: 'search' | 'read' | 'glob' | 'grep' | 'analyze';
    /** Target of exploration (file path, pattern, query) */
    target: string;
    /** Agent type performing exploration */
    agentType: 'Explore' | 'Plan' | 'general-purpose' | string;
    /** Parent tool call ID if spawned by Task tool */
    parentToolCallId?: string;
    /** Phase of exploration */
    phase: 'start' | 'progress' | 'complete';
    /** Number of results found */
    resultCount?: number;
    /** Brief description of findings */
    resultSummary?: string;
    /** Duration in milliseconds (on complete) */
    durationMs?: number;
  };
}

// ============================================================================
// Enhanced Tool Activity Event
// ============================================================================

/**
 * Decision logic for tool calls - explains WHY a tool is being called
 */
export interface DecisionLogic {
  /** Reason for calling this tool */
  why: string;
  /** Expected benefit from this tool call */
  benefit: string;
  /** What happens next after this tool completes */
  nextStep?: string;
}

/**
 * Enhanced tool activity event with decision logic and agent context
 */
export interface EnhancedToolActivityEvent extends BaseEvent {
  type: 'tool_activity';
  payload: {
    // Existing fields
    toolName: string;
    toolId: string;
    phase: 'start' | 'progress' | 'end';
    description: string;

    // Enhanced: Decision context
    decisionLogic?: DecisionLogic;

    // Enhanced: Tool details (expandable in UI)
    toolInput?: unknown;
    toolOutput?: unknown;
    toolError?: string;

    // Enhanced: Sub-agent context
    agentType?: string;
    parentAgentType?: string;
    nestingLevel?: number;

    // Timing
    duration?: number;
    success?: boolean;
  };
}

// ============================================================================
// Token Usage Events
// ============================================================================

/**
 * Token usage event - real-time token metrics
 */
export interface TokenUsageEvent extends BaseEvent {
  type: 'token_usage';
  payload: {
    // Current request tokens
    inputTokens: number;
    outputTokens: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;

    // Session cumulative totals
    sessionTotalTokens: number;
    sessionInputTokens: number;
    sessionOutputTokens: number;

    // Cost estimate (if configured)
    estimatedCostUsd?: number;

    // Context
    model: string;
    stopReason: string;
    messageId: string;
  };
}

// ============================================================================
// Enhanced Agent Status Event
// ============================================================================

/**
 * Goal narrative - context about what the agent is working on
 */
export interface GoalNarrative {
  title?: string;
  subject?: string;
  chapter?: string;
  edition?: string;
}

/**
 * Active sub-agent info
 */
export interface ActiveSubAgent {
  type: string;
  status: string;
  startedAt: string;
}

/**
 * Enhanced agent status event with detailed context
 */
export interface EnhancedAgentStatusEvent extends BaseEvent {
  type: 'agent_status';
  status: 'idle' | 'thinking' | 'exploring' | 'executing' | 'complete' | 'error';

  // Detailed status context
  context?: {
    currentAction?: string;
    currentTarget?: string;
    stepsCompleted?: number;
    stepsTotal?: number;
    percentComplete?: number;
    activeSubAgent?: ActiveSubAgent;
    goalNarrative?: GoalNarrative;
  };

  // Error message (when status='error')
  error?: string;
}

// ============================================================================
// Standard Events (unchanged but typed)
// ============================================================================

export interface TextDeltaEvent extends BaseEvent {
  type: 'text_delta';
  delta: string;
}

export interface OutputUpdateEvent extends BaseEvent {
  type: 'output_update';
  payload: {
    field?: string;
    value?: unknown;
    operation?: 'set' | 'append' | 'merge';
    progressive?: boolean;
    complete?: boolean;
    data?: unknown;
    status?: string;
    progress?: number;
  };
}

export interface TodoUpdateEvent extends BaseEvent {
  type: 'todo_update';
  payload: {
    todos: TodoItem[];
    completed: number;
    inProgress: number;
    pending: number;
    total: number;
  };
}

export interface TodoItem {
  id?: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  activeForm?: string;
  progress?: number;
}

// ============================================================================
// Chat Response Event
// ============================================================================

export interface ChatResponseEvent extends BaseEvent {
  type: 'chat_response';
  text: string;
  clientId?: string;
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * All frontend event types
 */
export type SessionEvent =
  | AgentThinkingEvent
  | ExplorationActivityEvent
  | EnhancedToolActivityEvent
  | TokenUsageEvent
  | EnhancedAgentStatusEvent
  | TextDeltaEvent
  | OutputUpdateEvent
  | TodoUpdateEvent
  | ChatResponseEvent;

/**
 * All event type strings
 */
export type SessionEventType = SessionEvent['type'];
