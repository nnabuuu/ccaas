/**
 * Token Usage Event Entity
 *
 * Tracks token usage per API call for cost analysis and caching effectiveness.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export interface ContextWindowUsage {
  used: number;
  limit: number;
  percentFull: number;
}

@Entity('token_usage_events')
@Index('IDX_token_usage_events_session_created_at', ['sessionId', 'createdAt'])
@Index('IDX_token_usage_events_message_id', ['messageId'])
@Index('IDX_token_usage_events_model', ['model'])
@Index('IDX_token_usage_events_tenant_created_at', ['tenantId', 'createdAt'])
export class TokenUsageEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index('IDX_token_usage_events_message_id_col')
  messageId!: string;

  @Column()
  @Index('IDX_token_usage_events_session_id')
  sessionId!: string;

  /**
   * Tenant ID for multi-tenancy support
   */
  @Column({ type: 'varchar', nullable: true })
  @Index('IDX_token_usage_events_tenant_id')
  tenantId?: string;

  /**
   * Model used (e.g., 'claude-opus-4.5', 'claude-sonnet-4')
   */
  @Column({ type: 'varchar', length: 100 })
  model!: string;

  /**
   * Input tokens for this request
   */
  @Column({ type: 'integer' })
  inputTokens!: number;

  /**
   * Output tokens for this request
   */
  @Column({ type: 'integer' })
  outputTokens!: number;

  /**
   * Cached input tokens (prompt caching)
   */
  @Column({ type: 'integer', default: 0 })
  cachedInputTokens!: number;

  /**
   * Cache read tokens
   */
  @Column({ type: 'integer', default: 0 })
  cacheReadTokens!: number;

  /**
   * Cache creation tokens
   */
  @Column({ type: 'integer', default: 0 })
  cacheCreationTokens!: number;

  /**
   * Reasoning/thinking tokens (extended thinking)
   */
  @Column({ type: 'integer', default: 0 })
  reasoningTokens!: number;

  /**
   * Context window usage snapshot
   */
  @Column({ type: 'simple-json', nullable: true })
  contextWindowUsage!: ContextWindowUsage | null;

  /**
   * Stop reason (e.g., 'end_turn', 'tool_use', 'max_tokens')
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  stopReason!: string | null;

  /**
   * Claude API message ID
   */
  @Column({ type: 'varchar', nullable: true })
  apiMessageId!: string | null;

  /**
   * Estimated cost in USD (based on model pricing)
   */
  @Column({ type: 'real', nullable: true })
  estimatedCostUsd!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
