/**
 * @ccaas/shared/types
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
  prompt: string;
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
  prompt: string;
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
// ============================================================================

export type FrontendEventType =
  | 'text_delta'
  | 'tool_activity'
  | 'thinking_delta'
  | 'agent_status'
  | 'token_usage'
  | 'error'
  | 'output_update';

export interface FrontendEvent {
  type: FrontendEventType;
  sessionId: string;
  timestamp: string;
}

export interface TextDeltaEvent extends FrontendEvent {
  type: 'text_delta';
  content: string;
}

export interface ToolActivityEvent extends FrontendEvent {
  type: 'tool_activity';
  toolName: string;
  status: 'started' | 'completed' | 'error';
  input?: unknown;
  output?: unknown;
  error?: string;
  duration?: number;
}

export interface ThinkingDeltaEvent extends FrontendEvent {
  type: 'thinking_delta';
  content: string;
}

export interface AgentStatusEvent extends FrontendEvent {
  type: 'agent_status';
  status: 'idle' | 'processing' | 'complete' | 'error';
  message?: string;
}

export interface TokenUsageEvent extends FrontendEvent {
  type: 'token_usage';
  usage: TokenUsage;
}

export interface ErrorEvent extends FrontendEvent {
  type: 'error';
  code: string;
  message: string;
  recoverable: boolean;
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
