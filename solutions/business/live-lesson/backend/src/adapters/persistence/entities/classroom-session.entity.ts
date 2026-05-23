import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';
import type { ClassroomSessionRecord } from '../../../domain/types/classroom-session';

@Entity('classroom_sessions')
@Unique(['code'])
export class ClassroomSession implements ClassroomSessionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 6 })
  code: string;

  @Column({ name: 'lesson_id' })
  lessonId: string;

  @Column({ default: 'waiting' })
  status: 'waiting' | 'active' | 'ended';

  @Column({ name: 'current_step', default: 0 })
  currentStep: number;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'ended_at', nullable: true })
  endedAt: Date | null;
}
