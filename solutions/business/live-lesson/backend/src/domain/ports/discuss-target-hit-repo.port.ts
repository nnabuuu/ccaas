/**
 * DiscussTargetHit repository port — domain-side contract for storing/loading
 * student target-point hits. Implemented by TypeOrmDiscussTargetHitRepository
 * in `adapters/persistence/repositories/`.
 */
import type { DiscussTargetHitRecord } from '../types/discuss-target-hit';

export const DISCUSS_TARGET_HIT_REPO_PORT = Symbol('DiscussTargetHitRepoPort');

/** Subset of TargetHit fields a caller writes on upsert (id + createdAt are server-set). */
export type DiscussTargetHitUpsert = Omit<DiscussTargetHitRecord, 'id' | 'createdAt'>;

/** Per-student count row for the depth-ranking aggregation. */
export interface DiscussTargetHitCountRow {
  studentId: string;
  studentName: string;
  cnt: string;
}

export interface DiscussTargetHitRepoPort {
  /** All target-point hits for a session (load on session boot). */
  findBySession(sessionId: string): Promise<DiscussTargetHitRecord[]>;

  /**
   * Subset of fields needed by the depth-ranking per-student gists path:
   * returns the targetPointId list for one (session, student) pair.
   */
  findTargetPointIdsBySessionAndStudent(
    sessionId: string,
    studentId: string,
  ): Promise<Array<Pick<DiscussTargetHitRecord, 'targetPointId'>>>;

  /**
   * Upsert a target-point hit. Conflict resolution is on
   * (sessionId, studentId, taskNum, targetPointId).
   */
  upsertHit(hit: DiscussTargetHitUpsert): Promise<void>;

  /** Aggregate: count rows per (studentId, studentName) for a session. */
  countBySessionGroupByStudent(sessionId: string): Promise<DiscussTargetHitCountRow[]>;
}
