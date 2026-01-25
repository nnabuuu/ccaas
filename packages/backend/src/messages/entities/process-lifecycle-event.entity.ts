/**
 * Process Lifecycle Event Entity
 *
 * Tracks CLI process lifecycle: spawn, exit, crash, restart.
 * Essential for debugging and understanding session behavior.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type ProcessEventType = 'spawn' | 'exit' | 'crash' | 'restart' | 'kill';

@Entity('process_lifecycle_events')
@Index('IDX_process_lifecycle_events_session_created_at', ['sessionId', 'createdAt'])
@Index('IDX_process_lifecycle_events_event_type', ['eventType'])
@Index('IDX_process_lifecycle_events_tenant_created_at', ['tenantId', 'createdAt'])
export class ProcessLifecycleEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index('IDX_process_lifecycle_events_session_id')
  sessionId!: string;

  /**
   * Tenant ID for multi-tenancy support
   */
  @Column({ type: 'varchar', nullable: true })
  @Index('IDX_process_lifecycle_events_tenant_id')
  tenantId?: string;

  /**
   * Type of lifecycle event
   */
  @Column({ type: 'varchar', length: 20 })
  eventType!: ProcessEventType;

  /**
   * Process ID (if available)
   */
  @Column({ type: 'integer', nullable: true })
  pid!: number | null;

  /**
   * Exit code (for exit/crash events)
   */
  @Column({ type: 'integer', nullable: true })
  exitCode!: number | null;

  /**
   * Signal that caused termination (e.g., 'SIGTERM', 'SIGKILL')
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  signal!: string | null;

  /**
   * Stderr output captured during crash/error
   */
  @Column({ type: 'text', nullable: true })
  stderr!: string | null;

  /**
   * Error message if any
   */
  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  /**
   * Command that was executed
   */
  @Column({ type: 'text', nullable: true })
  command!: string | null;

  /**
   * Working directory
   */
  @Column({ type: 'text', nullable: true })
  workingDir!: string | null;

  /**
   * Additional metadata
   */
  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
