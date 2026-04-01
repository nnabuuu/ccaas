import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { SyncField } from '../../../../mcp-server/src/common/types';
import { AnalysisJob } from './analysis-job.entity';

@Entity('job_steps')
export class JobStep {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  job_id: string;

  @Column('text')
  field: SyncField;

  @Column('text', { default: 'pending' })
  status: string; // pending / completed / failed

  @Column('text', { nullable: true })
  result: string; // JSON value

  @Column('integer', { default: 0 })
  retry_count: number;

  @Column('text', { nullable: true })
  error: string;

  @Column('text')
  created_at: string;

  @Column('text')
  updated_at: string;

  @ManyToOne(() => AnalysisJob, (job) => job.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: AnalysisJob;
}
