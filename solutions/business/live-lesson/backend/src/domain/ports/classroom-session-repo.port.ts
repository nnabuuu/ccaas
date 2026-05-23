import type { ClassroomSessionRecord } from '../types/classroom-session';

export const CLASSROOM_SESSION_REPO_PORT = Symbol('ClassroomSessionRepoPort');

export type ClassroomSessionStatus = 'waiting' | 'active' | 'ended';

export interface ClassroomSessionInsert {
  code: string;
  lessonId: string;
  status: ClassroomSessionStatus;
}

export interface ClassroomSessionListOptions {
  status?: ClassroomSessionStatus;
  limit: number;
  offset: number;
}

export interface ClassroomSessionRepoPort {
  findById(id: string): Promise<ClassroomSessionRecord | null>;
  findByCode(code: string): Promise<ClassroomSessionRecord | null>;
  /** Returns only the startedAt column for warmup checks. */
  findStartedAtById(id: string): Promise<{ startedAt: Date | null } | null>;
  /** For cleanup: ended sessions older than the cutoff. */
  findStaleEnded(cutoff: Date): Promise<Array<Pick<ClassroomSessionRecord, 'id' | 'lessonId'>>>;
  /** Batch lookup by id + status, filtered to sessions created after a cutoff. */
  findForBatchCheck(
    ids: string[],
    statuses: ClassroomSessionStatus[],
    cutoff: Date,
  ): Promise<ClassroomSessionRecord[]>;
  /** Paginated list ordered by createdAt desc. */
  findAndCount(opts: ClassroomSessionListOptions): Promise<[ClassroomSessionRecord[], number]>;
  insert(rec: ClassroomSessionInsert): Promise<ClassroomSessionRecord>;
  update(id: string, patch: Partial<ClassroomSessionRecord>): Promise<void>;
}
