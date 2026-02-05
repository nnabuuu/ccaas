import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('batch_analysis_jobs')
export class BatchAnalysisJob {
  @PrimaryColumn('varchar')
  id: string;

  @Column('varchar', { default: 'default' })
  tenant_id: string;

  @Column('varchar')
  name: string;

  @Column('varchar', { default: 'pending' })
  status: string; // pending, running, completed, failed, cancelled

  @Column('text')
  quiz_ids: string; // JSON array

  @Column('integer')
  total_count: number;

  @Column('integer', { default: 0 })
  completed_count: number;

  @Column('integer', { default: 0 })
  failed_count: number;

  @Column('text', { nullable: true })
  started_at: string;

  @Column('text', { nullable: true })
  completed_at: string;

  @Column('text', { nullable: true })
  estimated_completion: string; // ISO timestamp

  @Column('text', { nullable: true })
  error_message: string;

  @Column('text', { nullable: true })
  results: string; // JSON array of {quizId, status, error}

  @CreateDateColumn({ type: 'text' })
  created_at: string;

  @Column('varchar', { nullable: true })
  created_by: string;
}
