import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LessonPlanTemplate } from './lesson-plan-template.entity';

@Entity('template_promotions')
export class TemplatePromotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  template_id: string;

  @ManyToOne(() => LessonPlanTemplate)
  @JoinColumn({ name: 'template_id' })
  template: LessonPlanTemplate;

  @Column()
  from_scope: string;

  @Column()
  to_scope: string;

  @Column()
  submitter_id: string;

  @Column({ nullable: true })
  reviewer_id: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ default: '' })
  reason: string;

  @Column({ default: '' })
  review_comment: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
