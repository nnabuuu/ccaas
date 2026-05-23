/**
 * DiscussTargetHitRecord — the shape domain code reads from a target-hit row.
 * TypeORM `DiscussTargetHit` entity `implements DiscussTargetHitRecord`.
 */
export interface DiscussTargetHitRecord {
  id: number;
  sessionId: string;
  studentId: string;
  studentName: string;
  taskNum: number;
  targetPointId: string;
  evidenceSpan: string;
  hitAt: number;
  createdAt: Date;
}
