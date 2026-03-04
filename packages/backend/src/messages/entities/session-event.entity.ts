/**
 * SessionEvent Entity
 *
 * Generic event persistence for all frontend events (except text_delta).
 * Enables historical session reconstruction by storing structured events
 * like output_update, agent_status, todo_update, exploration_activity, etc.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('session_events')
@Index('IDX_session_events_session_type', ['sessionId', 'type'])
@Index('IDX_session_events_session_seq', ['sessionId', 'seq'])
@Index('IDX_session_events_tenant_created', ['tenantId', 'createdAt'])
export class SessionEventRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @Column({ type: 'varchar', nullable: true })
  tenantId: string | null;

  @Column({ type: 'varchar', nullable: true })
  messageId: string | null;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'simple-json' })
  payload: unknown;

  @Column({ type: 'integer' })
  seq: number;

  @CreateDateColumn()
  createdAt: Date;
}
