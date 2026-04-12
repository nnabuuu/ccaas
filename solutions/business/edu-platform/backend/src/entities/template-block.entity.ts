import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LessonPlanTemplate } from './lesson-plan-template.entity';

@Entity('template_blocks')
export class TemplateBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  template_id: string;

  @ManyToOne(() => LessonPlanTemplate, (tpl) => tpl.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: LessonPlanTemplate;

  @Column()
  type: string;

  @Column({ default: '' })
  placeholder: string;

  @Column({ type: 'simple-json', default: '{}' })
  content: Record<string, any>;

  @Column({ default: false })
  is_required: boolean;

  @Column({ default: 0 })
  sort_order: number;
}
