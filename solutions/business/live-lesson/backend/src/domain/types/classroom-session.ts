/**
 * ClassroomSessionRecord — the shape domain code reads from a session row.
 * TypeORM `ClassroomSession` entity `implements ClassroomSessionRecord`.
 */
export interface ClassroomSessionRecord {
  id: string;
  code: string;
  lessonId: string;
  status: 'waiting' | 'active' | 'ended';
  currentStep: number;
  startedAt: Date | null;
  createdAt: Date;
  endedAt: Date | null;
}
