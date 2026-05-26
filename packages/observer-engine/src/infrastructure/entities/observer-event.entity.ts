import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('observer_events')
@Index('IDX_observer_events_session_timestamp', ['sessionId', 'timestamp'])
@Index('IDX_observer_events_entity_session', ['entityId', 'sessionId'])
@Index('IDX_observer_events_tenant_session', ['solutionId', 'sessionId'])
export class ObserverEventRecord {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  type!: string;

  @Column({ type: 'varchar' })
  sessionId!: string;

  @Column({ type: 'varchar' })
  entityId!: string;

  @Column({ type: 'varchar' })
  solutionId!: string;

  @Column({ type: 'bigint' })
  timestamp!: number;

  @Column({ type: 'simple-json' })
  payload!: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, unknown> | null;
}
