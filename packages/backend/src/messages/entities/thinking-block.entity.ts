/**
 * Thinking Block Entity
 *
 * Captures extended thinking (reasoning) content from Claude.
 * Critical for understanding decision quality and reasoning patterns.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type ThinkingStatus = 'in_progress' | 'complete' | 'interrupted';

@Entity('thinking_blocks')
@Index('IDX_thinking_blocks_session_created_at', ['sessionId', 'createdAt'])
@Index('IDX_thinking_blocks_message_id', ['messageId'])
@Index('IDX_thinking_blocks_thinking_id', ['thinkingId'])
@Index('IDX_thinking_blocks_tenant_created_at', ['tenantId', 'createdAt'])
export class ThinkingBlock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index('IDX_thinking_blocks_message_id_col')
  messageId!: string;

  @Column()
  @Index('IDX_thinking_blocks_session_id')
  sessionId!: string;

  /**
   * Tenant ID for multi-tenancy support
   */
  @Column({ type: 'varchar', nullable: true })
  @Index('IDX_thinking_blocks_tenant_id')
  tenantId?: string;

  /**
   * Unique identifier for this thinking block (links start/delta/end events)
   */
  @Column()
  thinkingId!: string;

  /**
   * Full accumulated thinking content
   */
  @Column({ type: 'text' })
  content!: string;

  /**
   * Sequence number within the message (for multiple thinking blocks)
   */
  @Column({ type: 'integer', default: 0 })
  sequenceNumber!: number;

  /**
   * Status of the thinking block
   */
  @Column({ type: 'varchar', length: 20, default: 'in_progress' })
  status!: ThinkingStatus;

  /**
   * Reason for interruption (if status is 'interrupted')
   */
  @Column({ type: 'text', nullable: true })
  interruptionReason!: string | null;

  /**
   * Duration of thinking in milliseconds
   */
  @Column({ type: 'integer', nullable: true })
  durationMs!: number | null;

  /**
   * Thinking tokens used (if tracked separately)
   */
  @Column({ type: 'integer', nullable: true })
  thinkingTokens!: number | null;

  /**
   * Start timestamp of thinking
   */
  @Column({ type: 'datetime', nullable: true })
  startedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
