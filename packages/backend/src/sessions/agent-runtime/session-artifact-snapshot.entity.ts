/**
 * SessionArtifactSnapshot — per-(session, path) memory of what the
 * runtime's syncer last believed about each artifact's state.
 *
 * Used by `TypeOrmSnapshotStore` to back the `SnapshotStore` port
 * from `@kedge-agentic/agent-runtime`. Survives backend restart, so
 * a syncer woken up after a process bounce can resume the
 * conflict-detection invariant: dbChanged = (current DB hash ≠
 * stored snapshot hash).
 *
 * Lifecycle: rows are created/updated by the syncer at turn boundaries
 * and at session bootstrap. Rows are cleared when the session
 * terminates (handled by the syncer service, not by the entity).
 *
 * Storage cost: each row stores only the hash (64 hex chars) — not
 * the full content. For a 10-artifact project this is well under
 * 1 KB per session.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('session_artifact_snapshot')
@Index('idx_session_artifact_snapshot_sid_path', ['sessionId', 'path'], { unique: true })
export class SessionArtifactSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  sessionId: string;

  /** Workspace-relative path of the artifact (matches ArtifactSnapshot.path). */
  @Column({ type: 'text' })
  path: string;

  /** sha-256 hex of the content the syncer last saw / wrote. */
  @Column({ type: 'text' })
  contentHash: string;

  /** Solution-defined discriminator (e.g. "md", "json"). */
  @Column({ type: 'text' })
  type: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
