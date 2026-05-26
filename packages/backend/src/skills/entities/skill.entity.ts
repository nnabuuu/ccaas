/**
 * Skill Entity
 *
 * TypeORM entity for skills stored in the database.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SkillVersion } from './skill-version.entity';
import { SkillFile } from './skill-file.entity';
import { User } from '../../users/entities/user.entity';

export type SkillType = 'skill' | 'sub-agent';
export type SkillStatus = 'draft' | 'review' | 'published' | 'deprecated' | 'archived';
export type SkillScope = 'solution' | 'personal';

@Entity('skills')
@Index('idx_skills_solution_slug', ['solutionId', 'slug'], { unique: true })
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  solutionId: string;

  @Column({ nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdBy' })
  creator?: User | null;

  @Column({ type: 'varchar', default: 'solution' })
  scope: SkillScope;

  @Column()
  name: string;

  @Column()
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: 'skill' })
  type: SkillType;

  @Column({ type: 'simple-json', default: '{}' })
  config: Record<string, unknown>;

  @Column({ type: 'simple-json', default: '[]' })
  allowedTools: string[];

  @Column({ type: 'simple-json', default: '[]' })
  triggers: Array<{
    type: 'keyword' | 'intent' | 'pattern' | 'context';
    value: string;
    priority?: number;
    description?: string;
  }>;

  @Column({ default: 'draft' })
  status: SkillStatus;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: '1.0.0' })
  currentVersion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @OneToMany(() => SkillVersion, (version) => version.skill)
  versions: SkillVersion[];

  @OneToMany(() => SkillFile, (file) => file.skill)
  files: SkillFile[];
}
