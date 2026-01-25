/**
 * Large Content Entity
 *
 * Content-addressed storage for large outputs (>10KB).
 * Uses SHA-256 hash as the primary identifier to enable deduplication.
 */

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('large_content')
@Index('IDX_large_content_mime_type', ['mimeType'])
@Index('IDX_large_content_created_at', ['createdAt'])
export class LargeContent {
  /**
   * SHA-256 hash of the content (hex string, 64 chars)
   * This is the primary key for content-addressed storage
   */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  hash!: string;

  /**
   * The actual content (stored as text or compressed)
   */
  @Column({ type: 'text' })
  content!: string;

  /**
   * Size of the content in bytes
   */
  @Column({ type: 'integer' })
  size!: number;

  /**
   * MIME type of the content (e.g., 'application/json', 'text/plain')
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType!: string | null;

  /**
   * Reference count - how many records reference this content
   * Useful for garbage collection
   */
  @Column({ type: 'integer', default: 1 })
  refCount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
