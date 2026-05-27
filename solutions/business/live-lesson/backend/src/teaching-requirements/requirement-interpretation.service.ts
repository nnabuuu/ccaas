/**
 * RequirementInterpretationService — L2 (per-user overlay) CRUD.
 *
 * Operations all key on `(userId, reqId)` — that's the unique row
 * identity per the design. The reqId is **not validated against L1**
 * here on purpose:
 *   - Decoupling means L1 can ship a library version that drops items
 *     without breaking existing rows (they become orphaned but still
 *     readable).
 *   - The picker UI never lets teachers create an interpretation for
 *     a non-existent id; agent-on-behalf only goes through helper
 *     scripts that themselves consult L1. The DB constraint isn't
 *     load-bearing for correctness, only for cleanup tools.
 *
 * Trust: callers MUST pass an authenticated `userId`. Controllers
 * resolve it from auth context (see `user-context.ts`), never from
 * the request body — cross-user attribute is enforced at the
 * controller layer.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RequirementInterpretation } from './requirement-interpretation.entity';
import type { InterpretationOverlay } from './types';

@Injectable()
export class RequirementInterpretationService {
  constructor(
    @InjectRepository(RequirementInterpretation)
    private readonly repo: Repository<RequirementInterpretation>,
  ) {}

  /**
   * Find one user's interpretation of one req. Returns null when the
   * user has nothing recorded — the L1+L2 read path returns
   * `myInterpretation: null` in that case, not 404.
   */
  async find(
    userId: string,
    reqId: string,
  ): Promise<InterpretationOverlay | null> {
    const row = await this.repo.findOne({ where: { userId, reqId } });
    if (!row) return null;
    return { notes: row.notes, updatedAt: row.updatedAt };
  }

  /**
   * List all interpretations belonging to one user (cross-subject). The
   * artifact materializer in `ProjectService.listArtifactsWithContent`
   * calls this once per session and then partitions the rows by
   * subject (via each row's reqId membership in `getLibrary(subject)`)
   * to write one `_lib/my-interpretations/<subject>.md` per subject.
   */
  async listForUser(
    userId: string,
  ): Promise<Array<{ reqId: string; notes: string; updatedAt: string }>> {
    const rows = await this.repo.find({
      where: { userId },
      order: { reqId: 'ASC' },
    });
    return rows.map((r) => ({
      reqId: r.reqId,
      notes: r.notes,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Upsert this user's interpretation of one req. Idempotent: same
   * (userId, reqId) on subsequent calls overwrites `notes` + bumps
   * updatedAt. Returns the persisted row so the controller can echo
   * timestamps to the client.
   *
   * Atomic on the (userId, reqId) unique index — uses TypeORM's
   * `upsert` (which compiles to `INSERT … ON CONFLICT … DO UPDATE`).
   * The earlier check-then-act pattern raced when two tabs PUT at
   * the same instant, surfacing as 500 from UNIQUE violations on the
   * second insert.
   */
  async upsert(
    userId: string,
    reqId: string,
    notes: string,
  ): Promise<InterpretationOverlay> {
    await this.repo.upsert(
      { userId, reqId, notes },
      {
        conflictPaths: ['userId', 'reqId'],
        // skipUpdateIfNoValuesChanged would silently skip when notes
        // is unchanged — we WANT updatedAt to bump on every PUT so
        // the UI's "saved a moment ago" stays honest.
        skipUpdateIfNoValuesChanged: false,
      },
    );
    // TypeORM `upsert` doesn't return the affected row, so re-read.
    // SQLite default isolation is serializable per-statement so this
    // sees our own write.
    const row = await this.repo.findOne({ where: { userId, reqId } });
    if (!row) {
      throw new Error(
        `interpretation upsert succeeded but row vanished: ${userId}/${reqId}`,
      );
    }
    return { notes: row.notes, updatedAt: row.updatedAt };
  }

  /**
   * Hard delete. 404 if the user has no interpretation for this req —
   * idempotent-style "already gone" semantics could mask client bugs
   * (e.g. stale UI deleting twice), so we surface it.
   */
  async remove(userId: string, reqId: string): Promise<void> {
    const row = await this.repo.findOne({ where: { userId, reqId } });
    if (!row) {
      throw new NotFoundException(
        `no interpretation for user ${userId} on req ${reqId}`,
      );
    }
    await this.repo.remove(row);
  }
}
