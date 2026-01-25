/**
 * Skill Version Entity
 *
 * TypeORM entity for skill versions.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Skill } from './skill.entity';

export type DeploymentStatus = 'draft' | 'staging' | 'production' | 'deprecated';

@Entity('skill_versions')
export class SkillVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  skillId: string;

  @Column()
  version: string;

  @Column({ type: 'text' })
  content: string;

  @Column()
  contentHash: string;

  @Column({ type: 'simple-json', default: '{}' })
  config: Record<string, unknown>;

  @Column({ type: 'simple-json', default: '[]' })
  allowedTools: string[];

  @Column({ type: 'text', nullable: true })
  changelog: string;

  @Column({ default: 'draft' })
  deploymentStatus: DeploymentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  deployedAt: Date;

  @ManyToOne(() => Skill, (skill) => skill.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: Skill;
}
