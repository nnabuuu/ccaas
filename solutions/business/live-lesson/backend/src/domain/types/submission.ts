/**
 * SubmissionRecord — the shape domain code reads from a submission row.
 * TypeORM `Submission` entity `implements SubmissionRecord`.
 */
export interface SubmissionRecord {
  id: number;
  sessionId: string;
  lessonId: string;
  studentId: string;
  step: number;
  phase: string;
  // `any` here matches the persistence layer's typing — these JSON blobs hold
  // heterogeneous per-exercise-type data, so consumers narrow at usage time.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataJson: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scoreJson: Record<string, any> | null;
  submittedAt: Date;
}
