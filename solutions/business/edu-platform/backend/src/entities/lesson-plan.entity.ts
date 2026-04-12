import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ContentBlock } from './content-block.entity';

@Entity('lesson_plans')
export class LessonPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  requirement_id: string;

  @Column({ type: 'simple-json', nullable: true })
  requirement_snapshot: { code: string; text: string; version: string };

  @Column()
  subject_id: string;

  @Column()
  class_id: string;

  @Column({ default: 'new' })
  lesson_type: string;

  @Column({ default: 45 })
  duration_minutes: number;

  @Column({ default: 'draft' })
  status: string;

  @Column({ nullable: true })
  source_template_id: string;

  @Column({ default: 'manual' })
  source: string;

  @Column({ default: 'teacher' })
  scope: string;

  @Column({ default: false })
  is_deleted: boolean;

  @Column()
  user_id: string;

  @Column({ type: 'simple-json', nullable: true })
  exercise_ids: string[];

  @OneToMany(() => ContentBlock, (block) => block.lesson_plan, { cascade: true })
  blocks: ContentBlock[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
