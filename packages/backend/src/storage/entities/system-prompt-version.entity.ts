/**
 * System Prompt Version Entity
 *
 * Deduplicated storage for system prompts.
 * Uses content hash to avoid storing duplicate prompts across sessions.
 */

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('system_prompt_versions')
@Index('IDX_system_prompt_versions_created_at', ['createdAt'])
export class SystemPromptVersion {
  /**
   * SHA-256 hash of the prompt content (hex string, 64 chars)
   */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  hash!: string;

  /**
   * The system prompt content
   */
  @Column({ type: 'text' })
  content!: string;

  /**
   * Size in bytes
   */
  @Column({ type: 'integer' })
  size!: number;

  /**
   * Optional description/label for this prompt version
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  label!: string | null;

  /**
   * Reference count - how many sessions use this prompt
   */
  @Column({ type: 'integer', default: 1 })
  refCount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
