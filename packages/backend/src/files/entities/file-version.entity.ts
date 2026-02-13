/**
 * File Version Entity
 *
 * TypeORM entity for file versions.
 * Follows the same pattern as SkillVersion for consistency.
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
import { AgentFile } from './agent-file.entity';

@Entity('file_versions')
@Index('IDX_file_versions_file_id', ['fileId'])
@Index('IDX_file_versions_version', ['fileId', 'version'])
export class FileVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fileId: string;

  @Column()
  version: string; // Semantic version (1.0.0, 1.0.1, etc.)

  @Column()
  contentHash: string; // SHA-256 hash of file content

  @Column({ type: 'text' })
  storedPath: string; // Path to versioned file in storage

  @Column({ type: 'integer' })
  size: number;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @Column({ type: 'text', nullable: true })
  changelog: string | null; // Change description

  @Column({ type: 'varchar' })
  uploadedBy: 'agent' | 'user'; // Who created this version

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => AgentFile, (file) => file.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file: AgentFile;
}
