/** Shared observation types (merged from observation.service.ts + handlers) */

export type StudentObsStatus = 'active' | 'struggling' | 'stuck' | 'idle' | 'cruising';

export interface IndicatorDef {
  id: string;
  type: 'knowledge' | 'misconception';
  label: string;
  description: string;
}

export interface StudentEvent {
  id: string;
  timestamp: number;
  updatedAt: number;
  anchors: string[];
  gist: string;
  quote: string | null;
  source: 'llm' | 'system';
  systemType?: string;
  data?: Record<string, unknown>;
}

export interface StudentLog {
  studentId: string;
  studentName: string;
  events: StudentEvent[];
  systemMetrics: {
    messageCount: number;
    lastActiveAt: number;
    exerciseCorrectRate: number;
    currentStep: string;
  };
}

export interface Alert {
  timestamp: number;
  studentName: string;
  studentId: string;
  severity: 'info' | 'warn' | 'urgent';
  message: string;
  indicatorId: string | null;
}

export interface IndicatorStats {
  indicatorId: string;
  label: string;
  type: 'knowledge' | 'misconception';
  studentCount: number;
  latestGist: string;
  updatedAt: number;
}
