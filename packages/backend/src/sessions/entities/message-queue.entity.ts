import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type MessageQueueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface MessageQueuePayload {
  message: string;
  context?: Record<string, unknown>;
  enabledSkills?: string[];
  /** File attachments serialized as objects (simple-json handles nesting) */
  attachments?: Array<{ type: string; path: string }>;
  /** @deprecated Use `attachments` instead */
  attachmentPaths?: string[];
  /** Destroy session from pool after processing (one-shot pattern) */
  autoClose?: boolean;
  /** Pre-computed system prompt (skills + appendSystemPrompt, resolved at enqueue time) */
  systemPrompt?: string;
  /** Named session template to apply */
  templateName?: string;
  /** SSE subscriber ID for turn-scoped stream closure */
  subscriberId?: string;
  /** User ID for session ownership */
  userId?: string;
  /**
   * End user identity bound from `X-Ccaas-On-Behalf-Of` header at
   * request time. Threaded into ManagedSession on session creation
   * and read by the ToolCaller pipeline as
   * `ExecutionContext.actingUserId`. Never agent-writable.
   * See docs/design-tool-caller-proxy.md §4.3.
   */
  actingUserId?: string;
  /** Forward-compat role; bound from `X-Ccaas-Acting-Role`. */
  actingRole?: string;
  /** API key id captured for audit (`ExecutionContext.apiKeyId`). */
  apiKeyId?: string;
  /**
   * Source identity to attach the session to before spawning the
   * engine. When present, the worker awaits
   * `SessionService.attachWorkspaceSource` + `SessionAssetSyncer.sync`
   * BEFORE orchestrating the message, so the agent sees a populated
   * artifacts/ directory on its very first turn. Without this, attach
   * happens out-of-band via the `@OnEvent('session.bound')` listener
   * and races the engine spawn.
   */
  sourceIdentity?: string;
}

/**
 * Message Queue Entity
 *
 * Database-backed FIFO queue for chat messages per session.
 * Prevents race conditions from concurrent messages by enforcing
 * one-at-a-time processing per session using row-level locking.
 *
 * Key Features:
 * - FIFO ordering per session (by createdAt)
 * - Row-level pessimistic locking for dequeue
 * - Retry logic with exponential backoff
 * - Session-level concurrency control
 *
 * Status Flow:
 * pending → processing → completed/failed
 *         ↓ (if retry)
 *      pending (with nextRetryAt)
 */
@Entity('message_queue')
@Index('IDX_message_queue_session_status_created', ['sessionId', 'status', 'createdAt'])
@Index('IDX_message_queue_status_retry', ['status', 'nextRetryAt'])
@Index('IDX_message_queue_tenant_status', ['solutionId', 'status'])
export class MessageQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @Column()
  clientId: string;

  @Column({ type: 'varchar', nullable: true })
  solutionId: string | null;

  @Column({ type: 'simple-json' })
  payload: MessageQueuePayload;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: MessageQueueStatus;

  /**
   * Priority (higher = process first)
   * Default: 0 (normal priority)
   * Can be used for urgent messages or cancellation requests
   */
  @Column({ type: 'integer', default: 0 })
  priority: number;

  /**
   * Number of retry attempts made
   */
  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  /**
   * Maximum number of retries allowed
   */
  @Column({ type: 'integer', default: 2 })
  maxRetries: number;

  /**
   * Scheduled time for next retry attempt
   * Used for exponential backoff
   */
  @Column({ type: 'datetime', nullable: true })
  nextRetryAt: Date | null;

  /**
   * When processing started
   */
  @Column({ type: 'datetime', nullable: true })
  startedAt: Date | null;

  /**
   * When processing completed (success or permanent failure)
   */
  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  /**
   * Error message if processing failed
   */
  @Column({ type: 'text', nullable: true })
  error: string | null;

  /**
   * ID of the user message created from this queue item
   */
  @Column({ type: 'varchar', nullable: true })
  userMessageId: string | null;

  /**
   * ID of the assistant message created from this queue item
   */
  @Column({ type: 'varchar', nullable: true })
  assistantMessageId: string | null;

  /**
   * Processing duration in milliseconds
   */
  @Column({ type: 'integer', nullable: true })
  durationMs: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
