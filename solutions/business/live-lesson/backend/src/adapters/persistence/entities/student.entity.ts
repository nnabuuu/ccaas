import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, VersionColumn, Unique } from 'typeorm';

@Entity('reading_students')
@Unique(['sessionId', 'name'])
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'lesson_id' })
  lessonId: string;

  @Column()
  name: string;

  @Column({ name: 'current_task', default: 1 })
  currentTask: number;

  @Column({ name: 'current_phase', default: 'listen' })
  currentPhase: string;

  @Column({ name: 'step_started_at', nullable: true })
  stepStartedAt: string;

  @Column({ type: 'simple-json', name: 'discuss_meta', nullable: true })
  discussMeta: { startedAt: string; goalReached?: boolean; completionType?: 'goal_reached' | 'fallback_rounds' | 'fallback_time' } | null;

  @VersionColumn({ default: 1 })
  version: number;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
