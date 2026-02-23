/**
 * @kedge-agentic/common/types
 *
 * Shared TypeScript interfaces for Claude Code as a Service.
 *
 * @packageDocumentation
 */

// ============================================================================
// Session Types
// ============================================================================

export type SessionStatus = 'idle' | 'processing' | 'error' | 'completed' | 'cancelling';

/**
 * Session entity (also called "Conversation" in user-facing docs)
 * - User-facing term: "Conversation"
 * - Technical term: "Session"
 * - Both refer to the same persistent dialogue
 *
 * sessionId format: "conv_{uuid}" when using tenantId for persistence
 */
export interface Session {
  /** Unique session identifier */
  id: string;

  /** Tenant this session belongs to */
  tenantId: string;

  /** Current session status */
  status: SessionStatus;

  /** User-assigned or auto-generated conversation title */
  title?: string | null;

  /** User can pin important conversations */
  isPinned?: boolean;

  /** Pre-aggregated message count */
  messageCount?: number;

  /** Pre-aggregated total tokens */
  totalTokens?: number;

  /** Estimated cost in USD */
  estimatedCost?: number;

  /** Timestamp of last message activity */
  lastActivity?: string;

  /** Soft-delete marker (null = active) */
  closedAt?: string | null;

  /** Associated workspace directory */
  workspaceDir?: string | null;

  /** When this session was created */
  createdAt: string;

  /** When this session was last updated */
  updatedAt: string;

  /** Extensible metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Conversation is a type alias for Session
 * - Use "Conversation" in user-facing documentation
 * - Use "Session" in technical code
 * - Both refer to the same persistent dialogue entity
 */
export type Conversation = Session;

/**
 * Skill configuration hash entry
 */
export interface SkillConfigHash {
  /** Skill slug identifier */
  slug: string;

  /** SHA-256 hash of skill configuration */
  hash: string;
}

/**
 * ConversationContext captures reproducibility metadata
 * - Created once per session at startup
 * - 1:1 relationship with Session
 * - Use case: Recreate exact same conversation conditions later
 */
export interface ConversationContext {
  /** Unique context identifier */
  id: string;

  /** Session this context belongs to (unique constraint) */
  sessionId: string;

  /** Tenant ID for multi-tenancy */
  tenantId: string | null;

  /** SHA-256 hash of system prompt at session start */
  systemPromptHash: string | null;

  /** Skill configuration hashes at session start */
  skillConfigHashes: SkillConfigHash[] | null;

  /** MCP tools available at session start */
  mcpToolsList: string[] | null;

  /** Model used for this session */
  model: string | null;

  /** Workspace directory path */
  workspaceDir: string | null;

  /** Client identifier (browser/app) */
  clientId: string | null;

  /** Extensible metadata */
  metadata: Record<string, unknown> | null;

  /** When this context was captured */
  createdAt: string;
}

/**
 * SessionSummary provides lightweight session overview
 * - Used for list views and previews
 * - Includes aggregated metrics without full message history
 */
export interface SessionSummary {
  /** Unique session identifier */
  id: string;

  /** Tenant this session belongs to */
  tenantId: string;

  /** Current session status */
  status: SessionStatus;

  /** Total number of messages */
  messageCount: number;

  /** Aggregated token usage */
  tokenUsage: TokenUsage;

  /** When this session was created */
  createdAt: string;

  /** When this session was last updated */
  updatedAt: string;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message represents a single utterance from user or assistant
 * - Messages are ordered by messageIndex (0-based, sequential)
 * - Supports conversation branching via parentMessageId and branchId
 */
export interface Message {
  /** Unique message identifier */
  id: string;

  /** Session this message belongs to */
  sessionId: string;

  /** Who sent this message */
  role: MessageRole;

  /** Message text content */
  content: string;

  /** Position in conversation (0-based, sequential) */
  messageIndex: number;

  /** Parent message ID (for conversation branching) */
  parentMessageId?: string | null;

  /** Branch ID (groups messages in same branch) */
  branchId?: string | null;

  /** Marks reconnection continuation messages */
  isContinuation?: boolean;

  /** Detailed execution metadata */
  metadata?: MessageMetadata;

  /** Tool calls made in this message */
  toolCalls?: ToolCall[];

  /** Thinking blocks (extended reasoning) */
  thinkingBlocks?: ThinkingBlock[];

  /** @deprecated Use metadata.{inputTokens,outputTokens} instead */
  tokenUsage?: TokenUsage;

  /** When this message was created */
  createdAt: string;
}

/**
 * ToolCall represents an agent's function/tool invocation
 * - Tracks execution status and results
 * - Used for debugging and observability
 */
export interface ToolCall {
  /** Unique tool call identifier */
  id: string;

  /** Tool/function name being invoked */
  name: string;

  /** Input arguments passed to the tool */
  input: unknown;

  /** Output/result from the tool (undefined until completed) */
  output?: unknown;

  /** Current execution status */
  status: 'pending' | 'running' | 'completed' | 'error';

  /** Execution time in milliseconds */
  duration?: number;

  /** Error message if status is 'error' */
  error?: string;
}

/**
 * ThinkingBlock represents an agent's extended reasoning
 * - Used when model uses <thinking> tags for chain-of-thought
 * - Supports summarization for UX
 */
export interface ThinkingBlock {
  /** Unique thinking block identifier */
  id: string;

  /** Full thinking content */
  content: string;

  /** Optional summarized version for UI display */
  summary?: string;
}

// ============================================================================
// Turn Types
// ============================================================================

/**
 * Turn represents one complete exchange in a conversation
 * - User message (even index) + Assistant response (odd index)
 * - Used for per-turn analytics and cost tracking
 *
 * @example
 * Turn 0 = Message[0] (user) + Message[1] (assistant)
 * Turn 1 = Message[2] (user) + Message[3] (assistant)
 */
export interface Turn {
  /** Unique turn identifier */
  id: string;

  /** Session this turn belongs to */
  sessionId: string;

  /** Turn number (0-based, first turn = 0) */
  turnNumber: number;

  /** User message that initiated this turn */
  userMessageId: string;

  /** Assistant response (null until completion) */
  assistantMessageId: string | null;

  /** Total tokens used in this turn (input + output) */
  totalTokens: number;

  /** Duration from user message to assistant completion (ms) */
  durationMs: number;

  /** When this turn was created (user message received) */
  createdAt: string;

  /** When this turn completed (assistant response finished) */
  completedAt: string | null;
}

// ============================================================================
// Token Usage Types
// ============================================================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** Extended thinking tokens */
  reasoningTokens?: number;
}

/**
 * MessageMetadata contains execution details
 */
export interface MessageMetadata {
  /** Model used for generation */
  model?: string;

  /** Input tokens consumed */
  inputTokens?: number;

  /** Output tokens generated */
  outputTokens?: number;

  /** Total tokens (input + output) */
  totalTokens?: number;

  /** Cached input tokens (reused from cache) */
  cachedInputTokens?: number;

  /** Reasoning tokens (extended thinking) */
  reasoningTokens?: number;

  /** Why generation stopped */
  stopReason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
}

// ============================================================================
// Skill Types
// ============================================================================

export type SkillType = 'prompt' | 'workflow' | 'sub-agent' | 'tool-config';
export type SkillStatus = 'draft' | 'published' | 'archived';

/**
 * Skill defines an AI agent capability
 * - Can be a prompt template, workflow, or sub-agent
 * - Triggered by keywords, patterns, intents, or context
 * - Scoped to tenant for multi-tenancy
 *
 * @example
 * ```typescript
 * const skill: Skill = {
 *   id: "skill_123",
 *   tenantId: "my-tenant",
 *   name: "Code Reviewer",
 *   slug: "code-reviewer",
 *   type: "prompt",
 *   status: "published",
 *   content: "You are a code reviewer...",
 *   triggers: [{ type: "keyword", value: "review", priority: 10 }],
 *   toolWhitelist: ["read_file", "grep"],
 *   version: 1,
 *   createdAt: "2026-02-15T10:00:00Z",
 *   updatedAt: "2026-02-15T10:00:00Z"
 * }
 * ```
 */
export interface Skill {
  /** Unique skill identifier */
  id: string;

  /** Tenant this skill belongs to */
  tenantId: string;

  /** Human-readable skill name */
  name: string;

  /** URL-friendly identifier (unique per tenant) */
  slug: string;

  /** Optional description of skill purpose */
  description?: string;

  /** Skill type: prompt template, workflow, or sub-agent */
  type: SkillType;

  /** Publication status */
  status: SkillStatus;

  /** Skill content (prompt, workflow definition, etc) */
  content: string;

  /** When to trigger this skill */
  triggers?: SkillTrigger[];

  /** MCP tools this skill is allowed to use */
  toolWhitelist?: string[];

  /** Current semantic version number */
  version: number;

  /** When this skill was created */
  createdAt: string;

  /** When this skill was last updated */
  updatedAt: string;
}

/**
 * SkillTrigger defines when a skill should activate
 * - keyword: Exact word match (e.g., "review")
 * - pattern: Regex pattern (e.g., "fix.*bug")
 * - intent: Semantic intent classification
 * - context: Contextual conditions
 */
export interface SkillTrigger {
  /** Trigger matching strategy */
  type: 'keyword' | 'pattern' | 'intent' | 'context';

  /** Match value (keyword, regex, intent name, etc) */
  value: string;

  /** Higher priority skills trigger first (default: 0) */
  priority?: number;
}

/**
 * SkillVersion stores historical versions of a skill
 * - Used for auditing and rollback
 * - Preserves content, triggers, and configuration snapshots
 */
export interface SkillVersion {
  /** Unique version identifier */
  id: string;

  /** Parent skill ID */
  skillId: string;

  /** Version number (incremental) */
  version: number;

  /** Snapshot of skill content */
  content: string;

  /** Snapshot of skill triggers */
  triggers?: SkillTrigger[];

  /** Snapshot of tool whitelist */
  toolWhitelist?: string[];

  /** Optional changelog entry */
  changeLog?: string;

  /** When this version was created */
  createdAt: string;

  /** Who created this version */
  createdBy?: string;
}

// ============================================================================
// API Key Types
// ============================================================================

/**
 * ApiKeyScope defines granular permissions for API keys
 * - skills:*: Skill management operations
 * - mcp:*: MCP server management
 * - chat: WebSocket chat access
 * - analytics:read: View analytics data
 * - admin: Full administrative access
 */
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

/**
 * ApiKey represents an authentication credential
 * - Used for programmatic API access
 * - Scoped permissions per key
 * - Supports expiration and usage tracking
 */
export interface ApiKey {
  /** Unique API key identifier */
  id: string;

  /** Tenant this API key belongs to */
  tenantId: string;

  /** Human-readable key name */
  name: string;

  /** Key prefix for identification (e.g., "ccaas_live_") */
  prefix: string;

  /** Granted permissions */
  scopes: ApiKeyScope[];

  /** Optional expiration timestamp */
  expiresAt?: string;

  /** When this key was last used */
  lastUsedAt?: string;

  /** When this key was created */
  createdAt: string;
}

// ============================================================================
// Tenant Types
// ============================================================================

/**
 * Tenant represents a multi-tenancy isolation unit
 * - All sessions, skills, and API keys are scoped to a tenant
 * - Used for user/organization separation
 */
export interface Tenant {
  /** Unique tenant identifier */
  id: string;

  /** Organization/user display name */
  name: string;

  /** URL-friendly identifier */
  slug: string;

  /** Tenant-specific configuration */
  settings?: TenantSettings;

  /** When this tenant was created */
  createdAt: string;

  /** When this tenant was last updated */
  updatedAt: string;
}

/**
 * TenantSettings defines tenant-level quotas and restrictions
 */
export interface TenantSettings {
  /** Maximum concurrent sessions allowed */
  maxSessions?: number;

  /** Daily token usage limit */
  maxTokensPerDay?: number;

  /** Models this tenant can use */
  allowedModels?: string[];
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * TokenUsageSummary aggregates token usage per day
 * - Used for billing and quota tracking
 * - Grouped by date
 */
export interface TokenUsageSummary {
  /** Date for this summary (YYYY-MM-DD) */
  date: string;

  /** Total input tokens consumed */
  inputTokens: number;

  /** Total output tokens generated */
  outputTokens: number;

  /** Total tokens (input + output) */
  totalTokens: number;

  /** Estimated cost in USD */
  cost: number;
}

/**
 * SessionAnalytics provides session-level statistics
 * - Used for dashboard metrics and monitoring
 */
export interface SessionAnalytics {
  /** Total number of sessions */
  totalSessions: number;

  /** Currently active sessions */
  activeSessions: number;

  /** Successfully completed sessions */
  completedSessions: number;

  /** Sessions that ended with errors */
  errorSessions: number;

  /** Average session duration in milliseconds */
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
// Session Template Types
// ============================================================================

/**
 * MCP Server configuration for session templates
 */
export interface McpServerConfig {
  command: string;
  args: string[];
  description?: string;
  env?: Record<string, string>;
}

/**
 * Session Template - named configuration preset for sessions
 *
 * Templates allow Solution backends to define reusable session configurations
 * that include specific skills, prompts, and MCP servers for different use cases.
 *
 * @example
 * ```json
 * {
 *   "teacher-analysis": {
 *     "description": "教师视图 - 完整分析功能",
 *     "appendSystemPrompt": "你是教育领域的专业分析师...",
 *     "enabledSkillSlugs": ["knowledge-point-matching", "complete-analysis"],
 *     "mcpServers": { "quiz-analyzer-tools": { ... } }
 *   }
 * }
 * ```
 */
export interface SessionTemplate {
  /** Human-readable description of this template */
  description?: string;

  /** Additional system prompt to append to skill prompts */
  appendSystemPrompt?: string;

  /** Skill slugs to enable for this session */
  enabledSkillSlugs?: string[];

  /** MCP servers to configure for this session */
  mcpServers?: Record<string, McpServerConfig>;

  /** Model to use (reserved for future use) */
  model?: string;

  /** Max tokens per request (reserved for future use) */
  maxTokens?: number;

  /** Skill path override */
  skillPath?: string;

  /** Session TTL in milliseconds (overrides tenant default, bounded by plan max) */
  sessionTtlMs?: number;
}

/**
 * Map of template names to template configurations
 */
export type SessionTemplateMap = Record<string, SessionTemplate>;

