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

export type TenantPlan = 'free' | 'starter' | 'professional' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'pending' | 'deleted';

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
    };
    sessionTemplates?: SessionTemplateMap;
    defaultSessionTemplate?: string;
    solutionAppliedAt?: string;
  };

  @Column({ default: 100 })
  maxSessions: number;

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
