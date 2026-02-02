/**
 * LessonPlan Entity
 *
 * TypeORM entity for lesson plans stored in the database.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import type {
  LessonPlanStatus,
  LearningObjective,
  Standard,
  Material,
  Activity,
  Assessment,
  Differentiation,
} from '@ccaas/common';

@Entity('lesson_plans')
export class LessonPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  title: string;

  @Column()
  subject: string;

  @Column()
  gradeLevel: string;

  @Column()
  duration: string;

  @Column({ type: 'simple-json', default: '[]' })
  objectives: LearningObjective[];

  @Column({ type: 'simple-json', default: '[]' })
  standards: Standard[];

  @Column({ type: 'simple-json', default: '[]' })
  materials: Material[];

  @Column({ type: 'simple-json', default: '[]' })
  activities: Activity[];

  @Column({ type: 'simple-json', default: '{"formative":[],"summative":[]}' })
  assessment: Assessment;

  @Column({ type: 'simple-json', default: '{"struggling":[],"onLevel":[],"advanced":[]}' })
  differentiation: Differentiation;

  @Column({ default: 'draft' })
  status: LessonPlanStatus;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
