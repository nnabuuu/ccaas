/** Student-related response types */

import type { GradeResult } from '../grade-result.schema';

export interface JoinResponse {
  studentId: string;
  name: string;
  lessonId: string;
  _broadcast: boolean;
}

export interface SubmitResponse {
  ok: boolean;
  score: GradeResult | null;
  currentTask: number;
  currentPhase: string;
}

export interface SubmissionResponse {
  data: unknown;
  score: GradeResult | null;
  submittedAt: string;
}

export interface StudentProgressResponse {
  currentTask: number;
  currentPhase: string;
  discussMeta: Record<string, unknown> | null;
  submissions?: Record<number, { data: unknown; score: GradeResult | null; checkItems?: Array<Record<string, unknown>> }>;
}

export interface ChatMessageResponse {
  role: string;
  content: string;
  seq: number;
  createdAt: string;
}

export interface SnapshotEntry {
  capturedAt: string;
  state: Record<string, unknown>;
}
