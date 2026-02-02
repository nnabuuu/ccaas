/**
 * @ccaas/common/types
 *
 * Shared TypeScript interfaces for Claude Code as a Service.
 *
 * @packageDocumentation
 */

// ============================================================================
// Session Types
// ============================================================================

export type SessionStatus = 'idle' | 'processing' | 'error' | 'completed';

export interface Session {
  id: string;
  tenantId: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface SessionSummary {
  id: string;
  tenantId: string;
  status: SessionStatus;
  messageCount: number;
  tokenUsage: TokenUsage;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  thinkingBlocks?: ThinkingBlock[];
  tokenUsage?: TokenUsage;
  createdAt: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
  error?: string;
}

export interface ThinkingBlock {
  id: string;
  content: string;
  summary?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

// ============================================================================
// Skill Types
// ============================================================================

export type SkillType = 'prompt' | 'workflow' | 'sub-agent' | 'tool-config';
export type SkillStatus = 'draft' | 'published' | 'archived';

export interface Skill {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  type: SkillType;
  status: SkillStatus;
  content: string;
  triggers?: SkillTrigger[];
  toolWhitelist?: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillTrigger {
  type: 'keyword' | 'pattern' | 'intent' | 'context';
  value: string;
  priority?: number;
}

export interface SkillVersion {
  id: string;
  skillId: string;
  version: number;
  content: string;
  triggers?: SkillTrigger[];
  toolWhitelist?: string[];
  changeLog?: string;
  createdAt: string;
  createdBy?: string;
}

// ============================================================================
// API Key Types
// ============================================================================

export type ApiKeyScope =
  | 'skills:read'
  | 'skills:write'
  | 'skills:execute'
  | 'skills:delete'
  | 'mcp:read'
  | 'mcp:write'
  | 'chat'
  | 'analytics:read'
  | 'admin';

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

// ============================================================================
// Tenant Types
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  settings?: TenantSettings;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  maxSessions?: number;
  maxTokensPerDay?: number;
  allowedModels?: string[];
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface TokenUsageSummary {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

export interface SessionAnalytics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  errorSessions: number;
  averageSessionDuration: number;
}

// ============================================================================
// Event Types (Socket.io)
// Re-exported from schemas for runtime validation support
// ============================================================================

export {
  // Types inferred from Zod schemas
  type BaseEvent,
  type TextDeltaEvent,
  type ToolActivityPayload,
  type ToolActivityEvent,
  type AgentStatusContext,
  type AgentStatusError,
  type AgentStatusEvent,
  type TokenUsagePayload,
  type TokenUsageEvent,
  type OutputUpdatePayload,
  type OutputUpdateEvent,
  type AgentThinkingPayload,
  type AgentThinkingEvent,
  type ExplorationActivityPayload,
  type ExplorationActivityEvent,
  type TodoItem as EventTodoItem,
  type TodoUpdatePayload,
  type TodoUpdateEvent,
  type SubAgentStartedEvent,
  type SubAgentCompletedPayload,
  type SubAgentCompletedEvent,
  type ErrorEvent,
  type FrontendEvent,
  type FrontendEventType,
  type DecisionLogic,
  type GoalNarrative,
  type ActiveSubAgent,
} from '../schemas/events';

// Legacy type alias for backward compatibility
/** @deprecated Use AgentThinkingEvent instead */
export interface ThinkingDeltaEvent {
  type: 'thinking_delta';
  sessionId: string;
  timestamp?: string;
  content: string;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// Job Types
// ============================================================================

export * from './job';

// ============================================================================
// Lesson Plan Types
// ============================================================================

export * from './lesson-plan';
