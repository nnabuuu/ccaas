import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('classroom_sessions')
@Unique(['code'])
export class ClassroomSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 6 })
  code: string;

  @Column({ name: 'lesson_id' })
  lessonId: string;

  @Column({ default: 'active' })
  status: 'active' | 'ended';

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'ended_at', nullable: true })
  endedAt: Date | null;
}
