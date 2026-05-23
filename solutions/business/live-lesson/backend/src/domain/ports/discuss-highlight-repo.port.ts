/**
 * DiscussHighlight repository port. Methods are driven by actual consumer usage
 * in `coaching.service` (highlight restore + upsert) and `depth-ranking.service`
 * (top-N gists per student + cross-session count aggregation).
 */
import type { DiscussHighlightRecord } from '../types/discuss-highlight';

export const DISCUSS_HIGHLIGHT_REPO_PORT = Symbol('DiscussHighlightRepoPort');

/** Write shape (id + createdAt are server-set). */
export type DiscussHighlightUpsert = Omit<DiscussHighlightRecord, 'id' | 'createdAt'>;

export interface DiscussHighlightCountRow {
  studentId: string;
  studentName: string;
  cnt: string;
}

export interface DiscussHighlightRepoPort {
  /** All highlights for a session, oldest first (used for restore). */
  findBySession(sessionId: string): Promise<DiscussHighlightRecord[]>;

  /**
   * Top-N highlight gists for a (session, student), newest first.
   * Used by depth-ranking to construct per-student summary prompts.
   */
  findTopGistsBySessionAndStudent(
    sessionId: string,
    studentId: string,
    limit: number,
  ): Promise<Array<Pick<DiscussHighlightRecord, 'gist'>>>;

  /** Upsert with conflict on (sessionId, studentId, taskNum, clusterId). */
  upsertHighlight(h: DiscussHighlightUpsert): Promise<void>;

  /** Aggregate: count rows per (studentId, studentName) for a session. */
  countBySessionGroupByStudent(sessionId: string): Promise<DiscussHighlightCountRow[]>;
}
