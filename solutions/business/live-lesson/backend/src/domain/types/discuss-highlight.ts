/**
 * DiscussHighlightRecord — the shape domain code reads from a highlight row.
 * TypeORM `DiscussHighlight` entity `implements DiscussHighlightRecord`.
 */
export interface DiscussHighlightRecord {
  id: number;
  sessionId: string;
  studentId: string;
  studentName: string;
  taskNum: number;
  clusterId: string;
  message: string;
  gist: string;
  evidenceSpan: string;
  detectedAt: number;
  createdAt: Date;
}
