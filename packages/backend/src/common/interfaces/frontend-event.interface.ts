/**
 * Frontend Event Interfaces
 *
 * Types for events sent to the frontend via Socket.io.
 */

/**
 * Base frontend event
 */
export interface FrontendEvent {
  type: string;
  sessionId?: string;
  clientId?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Agent status event
 */
export interface AgentStatusEvent extends FrontendEvent {
  type: 'agent_status';
  status: 'idle' | 'running' | 'complete' | 'error';
  exitCode?: number | null;
  error?: string;
}

/**
 * Text delta event (streaming text)
 */
export interface TextDeltaEvent extends FrontendEvent {
  type: 'text_delta';
  text: string;
}

/**
 * Chat response event (complete text)
 */
export interface ChatResponseEvent extends FrontendEvent {
  type: 'chat_response';
  text: string;
}

/**
 * Decision logic for tool calls - explains WHY a tool is being called
 */
export interface DecisionLogic {
  why: string;
  benefit: string;
  nextStep?: string;
}

/**
 * Tool activity event
 */
export interface ToolActivityEvent extends FrontendEvent {
  type: 'tool_activity';
  payload: {
    toolName: string;
    toolId: string;
    phase: 'start' | 'end';
    description?: string;
    success?: boolean;
    duration?: number;
    toolInput?: Record<string, unknown>;
    toolOutput?: string | object;
    toolError?: string;
    decisionLogic?: DecisionLogic;
    agentType?: string;
    nestingLevel?: number;
    timestamp: string;
  };
}

/**
 * Output update event (from write_output tool)
 */
export interface OutputUpdateEvent extends FrontendEvent {
  type: 'output_update';
  payload: {
    data: unknown;
    status: string;
    progress?: number;
    timestamp: string;
  };
}

/**
 * Todo update event (from todo_write tool)
 */
export interface TodoUpdateEvent extends FrontendEvent {
  type: 'todo_update';
  payload: {
    todos: Array<{
      content?: string;
      status?: string;
      [key: string]: unknown;
    }>;
    completed: number;
    inProgress: number;
    pending: number;
    total: number;
    timestamp: string;
  };
}

/**
 * Agent thinking event - extended thinking
 */
export interface AgentThinkingEvent extends FrontendEvent {
  type: 'agent_thinking';
  payload: {
    phase: 'start' | 'delta' | 'end';
    content?: string;
    thinkingId: string;
  };
}

/**
 * Exploration activity event
 */
export interface ExplorationActivityEvent extends FrontendEvent {
  type: 'exploration_activity';
  payload: {
    action: 'search' | 'read' | 'glob' | 'grep' | 'analyze';
    target: string;
    agentType: string;
    phase: 'start' | 'progress' | 'complete';
    resultCount?: number;
    resultSummary?: string;
    durationMs?: number;
  };
}

/**
 * Token usage event
 */
export interface TokenUsageEvent extends FrontendEvent {
  type: 'token_usage';
  payload: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
    sessionTotalTokens: number;
    sessionInputTokens: number;
    sessionOutputTokens: number;
    model: string;
    stopReason: string;
    messageId: string;
  };
}

/**
 * Session restored event (reconnection success)
 */
export interface SessionRestoredEvent extends FrontendEvent {
  type: 'session_restored';
  status: string;
  messageCount: number;
  createdAt: string;
}

/**
 * Session not found event (reconnection failed)
 */
export interface SessionNotFoundEvent extends FrontendEvent {
  type: 'session_not_found';
}

/**
 * Custom tool handler for special tool results
 */
export type CustomToolHandler = (
  toolName: string,
  result: string | object,
  sessionId: string,
  clientId: string,
  timestamp: string,
) => FrontendEvent[];

/**
 * Tool description generator
 */
export type ToolDescriptionGenerator = (
  toolName: string,
  input?: Record<string, unknown>,
) => string;
