/** getState response decomposition */

import type { GradeResult } from '../grade-result.schema';
import type { SessionStatus } from './session';
import type { StudentLog, Alert, IndicatorStats, IndicatorDef } from './observation';
import type { DiscussionHighlight, CoachingInsight } from './coaching';
import type { ClusterStats } from './clustering';
import type { DepthLeaderboard } from './depth-ranking';

// ── Notification ──

export interface ActiveNotification {
  id: string;
  message: string;
  notifyType: string;
  timestamp: string;
}

// ── Enriched submission (per-student per-step) ──

export interface EnrichedSubmission {
  step: number;
  data: unknown;
  score: GradeResult | null;
  submittedAt: string;
  duration: number | null;
  timeFormatted: string | null;
  result: string;
  aiRoundsCount: number;
}

// ── Step history entry (per-student per-task) ──

export interface StudentStepHistory {
  status: string;
  result?: string;
  time?: string | null;
  aiRounds?: number;
}

// ── Full student state in getState ──

export interface StudentState {
  id: string;
  name: string;
  currentTask: number;
  currentPhase: string;
  stepStartedAt: string;
  status: string;
  submissions: Record<number, EnrichedSubmission>;
  stepHistory: Record<number, StudentStepHistory>;
  discussMeta: Record<string, unknown> | null;
  bonusStatus: 'none' | 'active' | 'completed';
}

// ── Per-step metrics ──

export interface StepMetrics {
  name: string;
  desc: string;
  currentCount: number;
  completedCount: number;
  completionRate: number;
  avgScore: number;
  byDimension: Record<string, { good: number; partial: number; wrong: number }>;
  quality: { cols: Array<{ name: string; good: number; partial: number; wrong: number }> };
  avgTime: number | null;
  medianTime: number | null;
  avgTimeFormatted: string | null;
  medianTimeFormatted: string | null;
  aiRounds: number;
  aiPeople: number;
  alertTag?: string | null;
  issues: string[];
  questionAggregates: Record<string, { count: number; isHigh: boolean }>;
  attemptMetrics: Record<string, { avgAttempts: number; walkthroughRate: number }>;
  dimensionLabels: Record<string, string>;
  scaffoldDistribution?: {
    independent: number;
    partial: number;
    full: number;
  };
}

// ── Health cards ──

export interface HealthCards {
  furthest: { step: number; count: number };
  median: { step: number };
  stuck: { count: number; location: string };
  aiTotal: { rounds: number; people: number };
}

// ── Question record ──

export interface QuestionRecord {
  studentId: string;
  studentName: string;
  step: number;
  question: string;
  answer: string;
  category: string;
  timestamp: string;
}

// ── Observation block ──

export interface ObservationBlock {
  logs: StudentLog[];
  alerts: Alert[];
  indicatorStats: IndicatorStats[];
  indicators: IndicatorDef[];
}

// ── Coaching block ──

export interface CoachingBlock {
  highlights: DiscussionHighlight[];
  llmInsights: CoachingInsight | null;
}

// ── Cluster stats block ──

export interface ClusterStatsBlock {
  definitions: Array<{ id: string; label: string }>;
  clusters: ClusterStats[];
}

// ── Top-level getState response ──

export interface ClassroomStateResponse {
  sessionStatus: SessionStatus;
  currentStep: number;
  activeNotifications: ActiveNotification[];
  students: StudentState[];
  metrics: { total: number; submitted: number; inProgress: number };
  stepMetrics: Record<number, StepMetrics>;
  healthCards: HealthCards;
  questions: QuestionRecord[];
  observation: ObservationBlock;
  clusterStats: Record<number, ClusterStatsBlock>;
  coaching: CoachingBlock;
  depthLeaderboard: DepthLeaderboard | null;
}
