import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * One row per (student, submit) for task-demo sessions.
 *
 * Why not piggy-back on Submission: reading_submissions has
 * UNIQUE(sessionId, studentId, step, phase) — it keeps only the latest
 * answer. We need every attempt for submit-by-submit replay.
 */
@Entity('task_demo_attempts')
@Index(['sessionId', 'studentId'])
@Index(['sessionId', 'studentId', 'attempt'])
export class TaskDemoAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'lesson_id' })
  lessonId: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column()
  step: number;

  /** 1-indexed, monotonic per (sessionId, studentId). */
  @Column()
  attempt: number;

  @Column({ type: 'simple-json', name: 'data_json' })
  dataJson: Record<string, any>;

  @Column({ type: 'simple-json', name: 'score_json', nullable: true })
  scoreJson: Record<string, any> | null;

  @Column({ type: 'simple-json', name: 'check_items_json', nullable: true })
  checkItemsJson: Array<Record<string, any>> | null;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;
}
