/**
 * Tenant Entity
 *
 * TypeORM entity for tenants.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SessionTemplateMap } from '@kedge-agentic/common';

export type TenantPlan = 'free' | 'paid' | 'starter' | 'professional' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'pending' | 'deleted';

export const PLAN_MAX_SESSION_TTL_MS: Record<TenantPlan, number> = {
  free:           300_000,   //  5 min
  paid:           300_000,   //  5 min
  starter:      1_800_000,   // 30 min
  professional: 1_800_000,
  enterprise:   1_800_000,
};

export const PLAN_DEFAULT_SESSION_TTL_MS: Record<TenantPlan, number> = {
  free:           300_000,
  paid:           300_000,
  starter:      1_800_000,
  professional: 1_800_000,
  enterprise:   1_800_000,
};

/** Monthly token quota per plan. -1 = unlimited (BYOK). Input + output combined. */
export const PLAN_DEFAULT_TOKEN_QUOTA: Record<TenantPlan, number> = {
  free:           200_000,   // 平台提供 200K/mo（input+output 合计）
  paid:         2_000_000,   // 平台提供 2M/mo（input+output 合计）
  starter:        -1,        // unlimited (BYOK)
  professional:   -1,        // unlimited (BYOK)
  enterprise:     -1,        // unlimited (custom contract)
};

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'simple-json', default: '{}' })
  config: {
    defaultModel?: string;
    maxTokensPerRequest?: number;
    customSystemPrompt?: string;
    allowedDomains?: string[];
    webhookUrl?: string;
    features?: {
      enableSubAgents?: boolean;
      enableCustomMcp?: boolean;
      enableAnalytics?: boolean;
      eventPersistence?: {
        enabled?: boolean;
        excludeTypes?: string[];
      };
    };
    sessionTemplates?: SessionTemplateMap;
    defaultSessionTemplate?: string;
    solutionAppliedAt?: string;
    /** Enabled bundle IDs for this tenant (e.g. ['structured-output', 'file-attachments']) */
    enabledBundles?: string[];
  };

  @Column({ default: 100 })
  maxSessions: number;

  @Column({ default: 300000 })
  sessionTtlMs: number;

  @Column({ default: 50 })
  maxSkills: number;

  @Column({ default: 10 })
  maxMcpServers: number;

  @Column({ default: 'free' })
  plan: TenantPlan;

  @Column({ nullable: true })
  billingEmail: string;

  @Column({ default: 'active' })
  status: TenantStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
