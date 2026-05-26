import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ScheduledTaskExecution } from './scheduled-task-execution.entity';

export type ScheduleType = 'cron' | 'interval' | 'once';
export type ScheduledTaskStatus = 'active' | 'paused' | 'completed' | 'deleted';

@Entity('scheduled_tasks')
export class ScheduledTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  solutionId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column('text')
  message: string;

  @Column({ type: 'varchar', length: 20 })
  scheduleType: ScheduleType;

  @Column()
  scheduleValue: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: ScheduledTaskStatus;

  @Column({ type: 'simple-json', nullable: true })
  mcpServers?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  enabledSkills?: string[];

  @Column({ default: 1 })
  maxConcurrent: number;

  @Column({ default: 0 })
  maxRetries: number;

  @Column({ default: 60000 })
  retryDelayMs: number;

  @Column({ default: 600000 })
  timeoutMs: number;

  @Column({ type: 'datetime', nullable: true })
  lastRunAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  nextRunAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ScheduledTaskExecution, (exec) => exec.task)
  executions: ScheduledTaskExecution[];
}
