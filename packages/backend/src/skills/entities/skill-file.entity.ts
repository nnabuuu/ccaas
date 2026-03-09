/**
 * Skill File Entity
 *
 * Stores additional files (e.g. references/) associated with a skill.
 * The main SKILL.md content remains in skill.content for backward compatibility.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Skill } from './skill.entity';

@Entity('skill_files')
@Index('idx_skill_files_skill_path', ['skillId', 'relativePath'], {
  unique: true,
})
export class SkillFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  skillId: string;

  @ManyToOne(() => Skill, (skill) => skill.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: Skill;

  @Column()
  relativePath: string;

  @Column({ type: 'text' })
  content: string;

  @Column()
  contentHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
