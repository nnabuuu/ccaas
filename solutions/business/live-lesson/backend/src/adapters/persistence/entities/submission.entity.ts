import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique, Index } from 'typeorm';

@Entity('reading_submissions')
@Unique(['sessionId', 'studentId', 'step', 'phase'])
@Index(['sessionId', 'phase'])
export class Submission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'lesson_id' })
  lessonId: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column()
  step: number;

  @Column({ default: 'exercise' })
  phase: string;

  @Column({ type: 'simple-json', name: 'data_json' })
  dataJson: Record<string, any>;

  @Column({ type: 'simple-json', name: 'score_json', nullable: true })
  scoreJson: Record<string, any> | null;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;
}
