import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('observations')
@Index('IDX_observations_session_entity', ['sessionId', 'entityId'])
@Index('IDX_observations_session_type', ['sessionId', 'type'])
@Index('IDX_observations_tenant_session', ['tenantId', 'sessionId'])
export class ObservationRecord {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  sessionId!: string;

  @Column({ type: 'varchar' })
  entityId!: string;

  @Column({ type: 'varchar' })
  tenantId!: string;

  @Column({ type: 'varchar' })
  type!: string;

  @Column({ type: 'simple-json' })
  data!: Record<string, unknown>;

  @Column({ type: 'varchar' })
  triggerEventId!: string;

  @Column({ type: 'bigint' })
  createdAtEpoch!: number;

  @Column({ type: 'bigint' })
  updatedAtEpoch!: number;
}
