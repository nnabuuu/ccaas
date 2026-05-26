/**
 * API Key Entity
 *
 * Represents an API key for tenant authentication with scopes and rate limits.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Solution } from '../../solutions/entities/solution.entity';
import { User } from '../../users/entities/user.entity';
import type { ApiKeyScope, ApiKeyStatus, ApiKeyMetadata } from '../types';

@Entity('api_keys')
@Index('IDX_api_keys_key_hash', ['keyHash'], { unique: true })
@Index('IDX_api_keys_tenant_status', ['solutionId', 'status'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  solutionId!: string;

  @Column({ nullable: true })
  userId?: string | null;

  @ManyToOne(() => Solution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solutionId' })
  tenant?: Solution;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User | null;

  @Column()
  name!: string;

  @Column({ type: 'varchar', length: 64 })
  keyHash!: string; // SHA-256 hash of the key

  @Column({ type: 'varchar', length: 16 })
  keyPrefix!: string; // First 12 chars for display (e.g., "sk-default-xxx")

  @Column({ type: 'simple-json' })
  scopes!: ApiKeyScope[];

  @Column({ type: 'integer', default: 60 })
  rateLimitRpm!: number; // Requests per minute

  @Column({ type: 'integer', default: 10000 })
  rateLimitRpd!: number; // Requests per day

  @Column({ type: 'datetime', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  usageCount!: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: ApiKeyStatus;

  @Column({ type: 'datetime', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: ApiKeyMetadata | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
