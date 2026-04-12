import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TemplateBlock } from './template-block.entity';

@Entity('lesson_plan_templates')
export class LessonPlanTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: '' })
  description: string;

  @Column({ default: 'new' })
  lesson_type: string;

  @Column({ type: 'simple-json', default: '[]' })
  subject_ids: string[];

  @Column({ default: 'teacher' })
  scope: string;

  @Column({ default: '' })
  scope_id: string;

  @Column({ default: 'public' })
  visibility: string;

  @Column({ default: 1 })
  version: number;

  @Column({ default: '' })
  changelog: string;

  @Column({ default: 0 })
  usage_count: number;

  @Column({ nullable: true })
  source_template_id: string;

  @Column({ default: 'none' })
  promotion_status: string;

  @Column()
  user_id: string;

  @Column({ default: false })
  is_deleted: boolean;

  @OneToMany(() => TemplateBlock, (block) => block.template, { cascade: true })
  blocks: TemplateBlock[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
