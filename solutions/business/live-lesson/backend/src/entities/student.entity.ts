import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

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

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
