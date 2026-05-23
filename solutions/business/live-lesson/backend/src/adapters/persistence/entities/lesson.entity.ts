import { Entity, PrimaryColumn, Column } from 'typeorm';
import type { LessonRecord } from '../../../domain/types/lesson';

@Entity('lessons')
export class Lesson implements LessonRecord {
  @PrimaryColumn()
  id: string;

  @Column()
  title: string;

  @Column()
  subject: string;

  @Column({ name: 'grade_level' })
  gradeLevel: string;

  @Column({ default: '' })
  description: string;

  @Column({ default: '' })
  emoji: string;

  @Column({ name: 'lesson_type', default: 'interactive' })
  lessonType: string;

  @Column({ name: 'teaching_notes', nullable: true })
  teachingNotes: string;

  @Column({ name: 'manifest_json' })
  manifestJson: string;

  @Column({ name: 'created_at', default: () => "datetime('now')" })
  createdAt: string;

  @Column({ name: 'updated_at', default: () => "datetime('now')" })
  updatedAt: string;
}
