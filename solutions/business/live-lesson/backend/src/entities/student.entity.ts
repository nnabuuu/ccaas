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

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
