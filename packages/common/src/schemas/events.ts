/**
 * @ccaas/common/schemas/events
 *
 * Zod schemas for frontend event types.
 * These schemas match the backend's actual event structure.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// Base Event Schema
// ============================================================================

export const BaseEventSchema = z.object({
  type: z.string(),
  sessionId: z.string(),
  timestamp: z.string().optional(),
  clientId: z.string().optional(),
});

// ============================================================================
// Text Delta Event
// ============================================================================

export const TextDeltaEventSchema = BaseEventSchema.extend({
  type: z.literal('text_delta'),
  delta: z.string(),
});

// ============================================================================
// Tool Activity Event
// ============================================================================

export const DecisionLogicSchema = z.object({
  why: z.string(),
  benefit: z.string(),
  nextStep: z.string().optional(),
});

export const ToolActivityPayloadSchema = z.object({
  toolName: z.string(),
  toolId: z.string(),
  phase: z.enum(['start', 'progress', 'end']),
  description: z.string().optional(),

  // Decision context
  decisionLogic: DecisionLogicSchema.optional(),

  // Tool details (expandable in UI)
  toolInput: z.unknown().optional(),
  toolOutput: z.unknown().optional(),
  toolError: z.string().optional(),

  // Sub-agent context
  agentType: z.string().optional(),
  parentAgentType: z.string().optional(),
  nestingLevel: z.number().optional(),

  // Timing
  duration: z.number().optional(),
  success: z.boolean().optional(),
});

export const ToolActivityEventSchema = BaseEventSchema.extend({
  type: z.literal('tool_activity'),
  payload: ToolActivityPayloadSchema,
});

// ============================================================================
// Agent Status Event
// ============================================================================

export const GoalNarrativeSchema = z.object({
  title: z.string().optional(),
  subject: z.string().optional(),
  chapter: z.string().optional(),
  edition: z.string().optional(),
});

export const ActiveSubAgentSchema = z.object({
  subAgentId: z.string(),        // toolUseId
  agentType: z.string(),          // 'Explore' | 'Task' | 'NotebookLM' | etc.
  description: z.string().optional(),
  startedAt: z.string(),          // ISO timestamp
  status: z.enum(['running', 'completed', 'failed']),
  nestingLevel: z.number().optional(),
});

export const AgentStatusContextSchema = z.object({
  currentAction: z.string().optional(),
  currentTarget: z.string().optional(),
  stepsCompleted: z.number().optional(),
  stepsTotal: z.number().optional(),
  percentComplete: z.number().optional(),
  activeSubAgents: z.array(ActiveSubAgentSchema).optional(),  // CHANGED: array
  goalNarrative: GoalNarrativeSchema.optional(),
});

export const AgentStatusErrorSchema = z.string();

export const AgentStatusEventSchema = BaseEventSchema.extend({
  type: z.literal('agent_status'),
  sessionId: z.string().optional(),  // idle events may omit sessionId
  status: z.enum(['idle', 'thinking', 'exploring', 'executing', 'running', 'complete', 'error', 'cancelled']),
  context: AgentStatusContextSchema.optional(),
  error: z.string().optional(),
});

// ============================================================================
// Token Usage Event
// ============================================================================

export const TokenUsagePayloadSchema = z.object({
  // Current request tokens
  inputTokens: z.number(),
  outputTokens: z.number(),
  reasoningTokens: z.number().optional(),
  cachedInputTokens: z.number().optional(),

  // Session cumulative totals
  sessionTotalTokens: z.number(),
  sessionInputTokens: z.number(),
  sessionOutputTokens: z.number(),

  // Cost estimate
  estimatedCostUsd: z.number().optional(),

  // Context
  model: z.string(),
  stopReason: z.string(),
  messageId: z.string(),
});

export const TokenUsageEventSchema = BaseEventSchema.extend({
  type: z.literal('token_usage'),
  payload: TokenUsagePayloadSchema,
});

// ============================================================================
// Output Update Event
// ============================================================================

/**
 * Output Update Event - 用于 write_output MCP 工具同步内容到前端
 *
 * 该事件由 CCAAS 后端在 Claude 调用 `write_output` 工具时发送。
 * 前端应监听 `output_update` Socket.io 事件来接收这些更新。
 *
 * ## 事件结构
 *
 * 后端发送的实际结构使用嵌套的 `payload.data` 模式：
 *
 * ```typescript
 * {
 *   type: 'output_update',
 *   sessionId: 'session-123',
 *   timestamp: '2025-01-27T10:00:00.000Z',
 *   payload: {
 *     data: {
 *       field: 'solutionSteps',      // 目标字段名
 *       value: [...],                 // 字段值 (类型由 field 决定)
 *       preview: '解题步骤 1...'      // 可选的预览文本
 *     },
 *     status: 'success'              // 'success' | 'error'
 *   }
 * }
 * ```
 *
 * ## 前端使用示例
 *
 * ```typescript
 * // 监听事件
 * socket.on('output_update', (event: OutputUpdateEvent) => {
 *   // 注意: 数据在 payload.data 中，不是直接在 payload 上
 *   const { field, value, preview } = event.payload.data;
 *
 *   // 更新对应字段
 *   switch (field) {
 *     case 'solutionSteps':
 *       setSolutionSteps(value);
 *       break;
 *     case 'answer':
 *       setAnswer(value);
 *       break;
 *   }
 * });
 * ```
 *
 * ## 常见错误
 *
 * ❌ 错误: 直接访问 `event.payload.field`
 * ✅ 正确: 访问 `event.payload.data.field`
 *
 * @see write_output MCP 工具定义
 */
export const OutputUpdatePayloadSchema = z.object({
  field: z.string().optional(),
  value: z.unknown().optional(),
  operation: z.enum(['set', 'append', 'merge']).optional(),
  progressive: z.boolean().optional(),
  complete: z.boolean().optional(),
  data: z.unknown().optional(),
  status: z.string().optional(),
  progress: z.number().optional(),
});

export const OutputUpdateEventSchema = BaseEventSchema.extend({
  type: z.literal('output_update'),
  payload: OutputUpdatePayloadSchema,
});

// ============================================================================
// Thinking Delta Event (for extended thinking)
// ============================================================================

export const AgentThinkingPayloadSchema = z.object({
  phase: z.enum(['start', 'delta', 'end']),
  content: z.string().optional(),
  thinkingId: z.string(),
});

export const AgentThinkingEventSchema = BaseEventSchema.extend({
  type: z.literal('agent_thinking'),
  payload: AgentThinkingPayloadSchema,
});

// ============================================================================
// Exploration Activity Event
// ============================================================================

export const ExplorationActivityPayloadSchema = z.object({
  action: z.enum(['search', 'read', 'glob', 'grep', 'analyze']),
  target: z.string(),
  agentType: z.string(),
  parentToolCallId: z.string().optional(),
  phase: z.enum(['start', 'progress', 'complete']),
  resultCount: z.number().optional(),
  resultSummary: z.string().optional(),
  durationMs: z.number().optional(),
});

export const ExplorationActivityEventSchema = BaseEventSchema.extend({
  type: z.literal('exploration_activity'),
  payload: ExplorationActivityPayloadSchema,
});

// ============================================================================
// Todo Update Event
// ============================================================================

export const TodoItemSchema = z.object({
  id: z.string().optional(),
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  activeForm: z.string().optional(),
  progress: z.number().optional(),
});

export const TodoUpdatePayloadSchema = z.object({
  todos: z.array(TodoItemSchema),
  completed: z.number(),
  inProgress: z.number(),
  pending: z.number(),
  total: z.number(),
});

export const TodoUpdateEventSchema = BaseEventSchema.extend({
  type: z.literal('todo_update'),
  payload: TodoUpdatePayloadSchema,
});

// ============================================================================
// Error Event
// ============================================================================

export const ErrorEventSchema = BaseEventSchema.extend({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean(),
});

// ============================================================================
// SubAgent Lifecycle Events
// ============================================================================

export const SubAgentStartedEventSchema = BaseEventSchema.extend({
  type: z.literal('subagent_started'),
  payload: ActiveSubAgentSchema,
});

export const SubAgentCompletedPayloadSchema = z.object({
  subAgentId: z.string(),
  status: z.enum(['completed', 'failed']),
  durationMs: z.number().optional(),
  error: z.string().optional(),
});

export const SubAgentCompletedEventSchema = BaseEventSchema.extend({
  type: z.literal('subagent_completed'),
  payload: SubAgentCompletedPayloadSchema,
});

// ============================================================================
// Union Schema for All Frontend Events
// ============================================================================

export const FrontendEventSchema = z.discriminatedUnion('type', [
  TextDeltaEventSchema,
  ToolActivityEventSchema,
  AgentStatusEventSchema,
  TokenUsageEventSchema,
  OutputUpdateEventSchema,
  AgentThinkingEventSchema,
  ExplorationActivityEventSchema,
  TodoUpdateEventSchema,
  SubAgentStartedEventSchema,
  SubAgentCompletedEventSchema,
  ErrorEventSchema,
]);

// ============================================================================
// Inferred Types
// ============================================================================

export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type TextDeltaEvent = z.infer<typeof TextDeltaEventSchema>;
export type ToolActivityPayload = z.infer<typeof ToolActivityPayloadSchema>;
export type ToolActivityEvent = z.infer<typeof ToolActivityEventSchema>;
export type AgentStatusContext = z.infer<typeof AgentStatusContextSchema>;
export type AgentStatusError = z.infer<typeof AgentStatusErrorSchema>;
export type AgentStatusEvent = z.infer<typeof AgentStatusEventSchema>;
export type TokenUsagePayload = z.infer<typeof TokenUsagePayloadSchema>;
export type TokenUsageEvent = z.infer<typeof TokenUsageEventSchema>;
export type OutputUpdatePayload = z.infer<typeof OutputUpdatePayloadSchema>;
export type OutputUpdateEvent = z.infer<typeof OutputUpdateEventSchema>;
export type AgentThinkingPayload = z.infer<typeof AgentThinkingPayloadSchema>;
export type AgentThinkingEvent = z.infer<typeof AgentThinkingEventSchema>;
export type ExplorationActivityPayload = z.infer<typeof ExplorationActivityPayloadSchema>;
export type ExplorationActivityEvent = z.infer<typeof ExplorationActivityEventSchema>;
export type TodoItem = z.infer<typeof TodoItemSchema>;
export type TodoUpdatePayload = z.infer<typeof TodoUpdatePayloadSchema>;
export type TodoUpdateEvent = z.infer<typeof TodoUpdateEventSchema>;
export type SubAgentStartedEvent = z.infer<typeof SubAgentStartedEventSchema>;
export type SubAgentCompletedPayload = z.infer<typeof SubAgentCompletedPayloadSchema>;
export type SubAgentCompletedEvent = z.infer<typeof SubAgentCompletedEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type FrontendEvent = z.infer<typeof FrontendEventSchema>;
export type FrontendEventType = FrontendEvent['type'];
export type DecisionLogic = z.infer<typeof DecisionLogicSchema>;
export type GoalNarrative = z.infer<typeof GoalNarrativeSchema>;
export type ActiveSubAgent = z.infer<typeof ActiveSubAgentSchema>;
