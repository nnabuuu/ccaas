import type { StudentRecord } from '../types/student';

export const STUDENT_REPO_PORT = Symbol('StudentRepoPort');

export interface StudentInsert {
  sessionId: string;
  lessonId: string;
  name: string;
}

export interface StudentCountBySessionRow {
  sessionId: string;
  count: string;
}

export interface StudentRepoPort {
  findBySession(sessionId: string): Promise<StudentRecord[]>;
  /** Count students per session across a list of session IDs. */
  countBySessionInIds(sessionIds: string[]): Promise<StudentCountBySessionRow[]>;
  /** Single student lookup constrained to the session. */
  findBySessionAndId(sessionId: string, studentId: string): Promise<StudentRecord | null>;
  /** Lookup by (sessionId, name) — used by the join flow's uniqueness check. */
  findBySessionAndName(sessionId: string, name: string): Promise<StudentRecord | null>;
  insert(rec: StudentInsert): Promise<StudentRecord>;
  /**
   * Save a mutated record. Honors optimistic locking on the version column —
   * throws OptimisticLockVersionMismatchError if the record was changed concurrently.
   */
  save(record: StudentRecord): Promise<StudentRecord>;
  update(id: string, patch: Partial<StudentRecord>): Promise<void>;
}
