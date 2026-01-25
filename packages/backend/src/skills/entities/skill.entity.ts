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
} from 'typeorm';
import { SkillVersion } from './skill-version.entity';

export type SkillType = 'skill' | 'sub-agent';
export type SkillStatus = 'draft' | 'review' | 'published' | 'deprecated' | 'archived';

@Entity('skills')
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  name: string;

  @Column({ unique: true })
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

  @Column({ default: '1.0.0' })
  currentVersion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date;

  @OneToMany(() => SkillVersion, (version) => version.skill)
  versions: SkillVersion[];
}
