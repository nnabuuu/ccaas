import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ScheduledTask } from './scheduled-task.entity';

export type ExecutionStatus = 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';

@Entity('scheduled_task_executions')
export class ScheduledTaskExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  taskId: string;

  @Column()
  solutionId: string;

  @Column()
  sessionId: string;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: ExecutionStatus;

  @Column({ type: 'datetime' })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  durationMs?: number;

  @Column({ type: 'text', nullable: true })
  resultText?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ default: 1 })
  attemptNumber: number;

  @Column({ type: 'simple-json', nullable: true })
  tokenUsage?: { input: number; output: number; cached: number };

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ScheduledTask, (task) => task.executions)
  @JoinColumn({ name: 'taskId' })
  task: ScheduledTask;
}
