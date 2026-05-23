/**
 * StudentRecord — the shape domain code reads from a student row.
 * TypeORM `Student` entity `implements StudentRecord`.
 */
export interface StudentDiscussMeta {
  startedAt: string;
  goalReached?: boolean;
  completionType?: 'goal_reached' | 'fallback_rounds' | 'fallback_time';
}

export interface StudentRecord {
  id: string;
  sessionId: string;
  lessonId: string;
  name: string;
  currentTask: number;
  currentPhase: string;
  stepStartedAt: string;
  discussMeta: StudentDiscussMeta | null;
  version: number;
  joinedAt: Date;
}
