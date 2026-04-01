import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { JobStep } from './job-step.entity';

@Entity('analysis_jobs')
export class AnalysisJob {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  session_id: string;

  @Column('text')
  template: string; // analyze-explain / teacher / student / kp-refinement

  @Column('text', { default: 'pending' })
  status: string; // pending / running / completed / failed

  @Column('integer', { default: 0 })
  total_steps: number;

  @Column('integer', { default: 0 })
  completed_steps: number;

  @Column('text')
  created_at: string;

  @Column('text')
  updated_at: string;

  @Column('text', { nullable: true })
  completed_at: string;

  @OneToMany(() => JobStep, (step) => step.job)
  steps: JobStep[];
}
