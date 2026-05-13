/** Coaching types (from coaching.service.ts) */

export interface DiscussionHighlight {
  studentId: string;
  studentName: string;
  taskNum: number;
  clusterId: string;
  message: string;
  gist: string;
  evidenceSpan: string;
  detectedAt: number;
}

export interface CoachingStateInput {
  stepMetrics?: Record<number, {
    alertTag?: string;
    issues?: string[];
    byDimension?: Record<string, { good: number; partial: number; wrong: number }>;
  }>;
  healthCards?: { stuck?: { count: number; location?: string }; median?: { step: number } };
  observation?: { indicatorStats?: Array<{ label: string; studentCount: number; type: string }> };
}

export interface CoachingInsight {
  insights: Array<{
    title: string;
    detail: string;
    suggestedAction: string;
  }>;
  generatedAt: number;
}
