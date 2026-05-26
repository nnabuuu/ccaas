/**
 * User Context Event Entity
 *
 * Captures frontend page state: URL, selected text, custom context.
 * Useful for understanding user intent and context.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_context_events')
@Index('IDX_user_context_events_session_created_at', ['sessionId', 'createdAt'])
@Index('IDX_user_context_events_message_id', ['messageId'])
@Index('IDX_user_context_events_tenant_created_at', ['solutionId', 'createdAt'])
export class UserContextEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index('IDX_user_context_events_session_id')
  sessionId!: string;

  /**
   * Solution ID for multi-tenancy support
   */
  @Column({ type: 'varchar', nullable: true })
  @Index('IDX_user_context_events_solution_id')
  solutionId?: string;

  /**
   * Associated message ID (the message this context relates to)
   */
  @Column({ type: 'varchar', nullable: true })
  messageId!: string | null;

  /**
   * Page URL from frontend
   */
  @Column({ type: 'text', nullable: true })
  pageUrl!: string | null;

  /**
   * Page title
   */
  @Column({ type: 'text', nullable: true })
  pageTitle!: string | null;

  /**
   * Hash of selected text (to avoid storing PII)
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  selectedTextHash!: string | null;

  /**
   * Length of selected text
   */
  @Column({ type: 'integer', nullable: true })
  selectedTextLength!: number | null;

  /**
   * Custom context provided by frontend (sanitized)
   */
  @Column({ type: 'simple-json', nullable: true })
  customContext!: Record<string, unknown> | null;

  /**
   * Viewport dimensions
   */
  @Column({ type: 'simple-json', nullable: true })
  viewport!: { width: number; height: number } | null;

  /**
   * Whether user was in dark mode
   */
  @Column({ type: 'boolean', nullable: true })
  darkMode!: boolean | null;

  @CreateDateColumn()
  createdAt!: Date;
}
