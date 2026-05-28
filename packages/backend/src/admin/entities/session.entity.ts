/**
 * Session Entity
 *
 * Persistent storage for session data to enable backend pagination and historical queries.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type SessionStatus = 'idle' | 'processing' | 'error' | 'closed' | 'cancelling';

@Entity('sessions')
@Index('IDX_sessions_tenant_created_at', ['solutionId', 'createdAt'])
@Index('IDX_sessions_tenant_status', ['solutionId', 'status'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Unique session identifier (from AgentEngine)
   */
  @Column({ type: 'varchar', length: 255, unique: true })
  @Index('IDX_sessions_session_id')
  sessionId!: string;

  /**
   * Solution ID for multi-tenancy support
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index('IDX_sessions_solution_id')
  solutionId!: string | null;

  /**
   * User ID for user-scoped session history
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index('IDX_sessions_user_id')
  userId!: string | null;

  /**
   * End user the session is acting on behalf of. Bound from
   * `X-Ccaas-On-Behalf-Of` at session creation; never agent-writable.
   * Read by the ToolCaller pipeline as `ExecutionContext.actingUserId`.
   * Persisted so audit + history recover it after restart.
   * See docs/design-tool-caller-proxy.md §4.3.
   */
  @Column({ type: 'varchar', length: 128, nullable: true })
  @Index('IDX_sessions_acting_user_id')
  actingUserId!: string | null;

  /**
   * Forward-compat: declared role the session acts in. Not yet
   * enforced; the permission engine that reads this lands in a later
   * round. Bound from `X-Ccaas-Acting-Role` if the solution backend
   * sends it.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  actingRole!: string | null;

  /**
   * Client ID (browser/app identifier)
   */
  @Column({ type: 'varchar', length: 255 })
  clientId!: string;

  /**
   * Current session status
   */
  @Column({ type: 'varchar', length: 20 })
  @Index('IDX_sessions_status')
  status!: SessionStatus;

  /**
   * Total number of messages in this session
   */
  @Column({ type: 'integer', default: 0 })
  messageCount!: number;

  /**
   * Pre-aggregated total tokens used (updated periodically)
   */
  @Column({ type: 'integer', default: 0 })
  totalTokens!: number;

  /**
   * Pre-aggregated estimated cost in USD (updated periodically)
   */
  @Column({ type: 'real', default: 0 })
  estimatedCost!: number;

  /**
   * Session creation timestamp
   */
  @CreateDateColumn()
  createdAt!: Date;

  /**
   * Last activity timestamp (updated on every message/event)
   */
  @Column({ type: 'datetime' })
  @Index('IDX_sessions_last_activity')
  lastActivity!: Date;

  /**
   * Session closure timestamp (null if still active)
   */
  @Column({ type: 'datetime', nullable: true })
  closedAt!: Date | null;

  /**
   * Conversation title (user-assigned or auto-generated)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  /**
   * Whether this conversation is pinned by the user
   */
  @Column({ type: 'boolean', default: false })
  isPinned!: boolean;

  /**
   * Session template name (e.g., 'farmer-advisor', 'bank-assessor')
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index('IDX_sessions_template_name')
  templateName!: string | null;

  /**
   * Workspace directory path
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  workspaceDir!: string | null;

  /**
   * Auto-updated timestamp
   */
  @UpdateDateColumn()
  updatedAt!: Date;
}
