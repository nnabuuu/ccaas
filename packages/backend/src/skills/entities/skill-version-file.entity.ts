/**
 * Skill Version File Entity
 *
 * Snapshot of a skill file at a specific version.
 * When a version is created, all current SkillFiles are copied here.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SkillVersion } from './skill-version.entity';

@Entity('skill_version_files')
@Index('idx_svf_version_path', ['versionId', 'relativePath'], {
  unique: true,
})
export class SkillVersionFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  versionId: string;

  @ManyToOne(() => SkillVersion, (v) => v.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'versionId' })
  version: SkillVersion;

  @Column()
  relativePath: string;

  @Column({ type: 'text' })
  content: string;

  @Column()
  contentHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
