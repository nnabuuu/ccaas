export const TASK_DEMO_ATTEMPT_REPO_PORT = Symbol('TaskDemoAttemptRepoPort');

export interface TaskDemoAttemptRecord {
  id: string;
  sessionId: string;
  lessonId: string;
  studentId: string;
  step: number;
  attempt: number;
  dataJson: Record<string, any>;
  scoreJson: Record<string, any> | null;
  checkItemsJson: Array<Record<string, any>> | null;
  submittedAt: Date;
}

export interface TaskDemoAttemptInsert {
  sessionId: string;
  lessonId: string;
  studentId: string;
  step: number;
  attempt: number;
  dataJson: Record<string, any>;
  scoreJson: Record<string, any> | null;
  checkItemsJson: Array<Record<string, any>> | null;
}

export interface RespondentSummary {
  studentId: string;
  attemptCount: number;
  latestScore: Record<string, any> | null;
  latestSubmittedAt: Date | null;
}

export interface TaskDemoAttemptRepoPort {
  insert(rec: TaskDemoAttemptInsert): Promise<TaskDemoAttemptRecord>;
  /** Highest existing attempt index for (session, student); 0 if none. */
  maxAttempt(sessionId: string, studentId: string): Promise<number>;
  /** Per-student summary for a session, ordered by latestSubmittedAt desc. */
  summarizeBySession(sessionId: string): Promise<RespondentSummary[]>;
  /** All attempts for one student in this session, ordered by attempt asc. */
  findByStudent(sessionId: string, studentId: string): Promise<TaskDemoAttemptRecord[]>;
  /** Most recent attempt for (session, student); null if none — used by
   *  rich-content-quiz parts flow to read the prior partsProgress state. */
  findLatestByStudent(sessionId: string, studentId: string): Promise<TaskDemoAttemptRecord | null>;
}
