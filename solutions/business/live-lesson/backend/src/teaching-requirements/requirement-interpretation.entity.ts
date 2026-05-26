/**
 * RequirementInterpretation — L2 per-user overlay on L1 library items.
 *
 * See `docs/lesson-plan-format-design.md` §5.2:
 *   - Per-user cross-project: `(userId, reqId)` uniquely identifies an
 *     interpretation. The same teacher's reading of a standard is
 *     stable across all their projects.
 *   - Plain markdown `notes`: no rigid schema; teachers write examples,
 *     pitfalls, evaluation tips, whatever shape fits their thinking.
 *   - **Never embedded in lesson-plan.md**: this is sidecar data
 *     surfaced via API + materialized into `_lib/my-interpretations.md`
 *     at session bootstrap. Markdown files stay user-agnostic.
 *
 * Orphaned rows (L1 item deleted) are allowed; admin tooling can scan
 * + prompt cleanup. We don't cascade-delete because the user may want
 * to recover their text even after the library is revised.
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('requirement_interpretations')
@Index(['userId', 'reqId'], { unique: true })
export class RequirementInterpretation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  reqId!: string;

  /** Markdown body. No length cap at the DB layer (SQLite TEXT is unbounded). */
  @Column({ type: 'text' })
  notes!: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: string;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: string;
}
