import type { SubmissionRecord } from '../types/submission';

export const SUBMISSION_REPO_PORT = Symbol('SubmissionRepoPort');

export type SubmissionUpsert = Omit<SubmissionRecord, 'id' | 'submittedAt'>;

export interface SubmissionRepoPort {
  /** All exercise-phase submissions for a session. */
  findExerciseBySession(sessionId: string): Promise<SubmissionRecord[]>;
  /** All exercise-phase submissions for a student in a session. */
  findExerciseBySessionAndStudent(
    sessionId: string,
    studentId: string,
  ): Promise<SubmissionRecord[]>;
  /** Single submission row for (session, student, step) in the given phase. */
  findOneBySessionStudentStepPhase(
    sessionId: string,
    studentId: string,
    step: number,
    phase: string,
  ): Promise<SubmissionRecord | null>;
  /** Discuss-phase row count for a student. */
  countDiscussBySessionAndStudent(sessionId: string, studentId: string): Promise<number>;
  /** Bonus-step row count (step ≥ bonusStartStep) for a student. */
  countBonusBySessionAndStudent(
    sessionId: string,
    studentId: string,
    bonusStartStep: number,
  ): Promise<number>;
  /** N most-recent submissions for a student (ordered by submittedAt desc). */
  findRecentBySessionAndStudent(
    sessionId: string,
    studentId: string,
    limit: number,
  ): Promise<SubmissionRecord[]>;
  /** Upsert keyed on the entity's unique constraint (sessionId, studentId, step, phase). */
  upsert(rec: SubmissionUpsert): Promise<void>;
  /** Update a known row by id, overwriting dataJson + scoreJson. */
  updateData(id: number, patch: Partial<Pick<SubmissionRecord, 'dataJson' | 'scoreJson'>>): Promise<void>;
}
