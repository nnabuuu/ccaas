import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LessonPlan } from './lesson-plan.entity';

@Entity('content_blocks')
export class ContentBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  lesson_plan_id: string;

  @ManyToOne(() => LessonPlan, (lp) => lp.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_plan_id' })
  lesson_plan: LessonPlan;

  @Column()
  type: string;

  @Column({ type: 'simple-json' })
  content: Record<string, any>;

  @Column({ default: 0 })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
