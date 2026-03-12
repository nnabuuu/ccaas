import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

@Entity('jobs')
@Index('IDX_jobs_tenant_status', ['tenantId', 'status'])
@Index('IDX_jobs_session', ['sessionId'])
export class JobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({ nullable: true })
  sessionId?: string;

  @Column({ nullable: true })
  messageId?: string;

  @Column({ nullable: true })
  bgSessionId?: string;

  @Column()
  type: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: JobStatus;

  @Column('text')
  prompt: string;

  @Column({ type: 'text', nullable: true })
  resultText?: string;

  @Column({ type: 'simple-json', nullable: true })
  resultFiles?: { name: string; path: string; size: number; mimeType: string }[];

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ default: 3 })
  maxAttempts: number;

  @Column({ default: 600000 })
  timeoutMs: number;

  @Column({ type: 'simple-json', nullable: true })
  progress?: { step: string; percent: number };

  @Column({ type: 'simple-json', nullable: true })
  mcpServers?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  enabledSkills?: string[];

  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'simple-json', nullable: true })
  tokenUsage?: { input: number; output: number; cached: number };

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
