/**
 * SessionMetadata — per-session key/value store backed by the backend's
 * own SQLite (NOT the agentfs delta), so it works across both providers
 * and outlives the session's workspace cleanup.
 *
 * Use cases: solution-side "workflow step N of M", per-session feature
 * flags, experiment variants — anything that isn't a file but is tied
 * to one session.
 *
 * Bounds (enforced in `SessionMetadataService`, not at the DB level):
 *   - value: ≤ 64 KB per row
 *   - total: ≤ 256 KB across all keys for one sessionId
 *   - key: ≤ 200 chars, ^[A-Za-z0-9_.-]+$
 *
 * For larger payloads use the session FS (entities/, resources/, or
 * agent-written delta files).
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('session_metadata')
@Index('idx_session_meta_session_key', ['sessionId', 'key'], { unique: true })
export class SessionMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  sessionId: string;

  @Column({ type: 'text' })
  key: string;

  /** Stored as a JSON string. Service layer JSON.parse/stringify-s. */
  @Column({ type: 'text' })
  value: string;

  /** Optional: tenant the session belongs to, for filterable bulk queries. */
  @Column({ type: 'text', nullable: true })
  solutionId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
