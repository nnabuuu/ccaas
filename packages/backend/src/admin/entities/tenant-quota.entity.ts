/**
 * Tenant Quota Entity
 *
 * Tracks usage quotas and current consumption for each tenant.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type QuotaPeriod = 'monthly' | 'daily';

@Entity('tenant_quotas')
@Index('IDX_tenant_quotas_tenant_period', ['tenantId', 'period'], { unique: true })
export class TenantQuota {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  @Index('IDX_tenant_quotas_tenant_id')
  tenantId!: string;

  @Column({ type: 'varchar', length: 20, default: 'monthly' })
  period!: QuotaPeriod;

  // --- Limits ---

  @Column({ type: 'integer', default: 1000000 })
  maxTokens!: number;

  @Column({ type: 'integer', default: 100 })
  maxSessions!: number;

  @Column({ type: 'integer', default: 10000 })
  maxApiCalls!: number;

  // --- Current Usage ---

  @Column({ type: 'integer', default: 0 })
  currentTokens!: number;

  @Column({ type: 'integer', default: 0 })
  currentSessions!: number;

  @Column({ type: 'integer', default: 0 })
  currentApiCalls!: number;

  // --- Alert threshold (percentage, e.g., 80 = 80%) ---

  @Column({ type: 'integer', default: 80 })
  alertThreshold!: number;

  // --- Period boundaries ---

  @Column({ type: 'datetime' })
  periodStart!: Date;

  @Column({ type: 'datetime' })
  periodEnd!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
