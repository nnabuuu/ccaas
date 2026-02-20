// SYNC_FIELDS - Must match frontend/src/types/index.ts and backend definitions
export const SYNC_FIELDS = [
  'problemAnalysis',
  'keyKnowledge',
  'solutionSteps',
  'answer',
  'commonMistakes',
  'relatedProblems',
  'hints',
  'difficulty',
] as const;

export type SyncField = (typeof SYNC_FIELDS)[number];

export interface SolutionStep {
  stepNumber: number;
  description: string;
  formula?: string;
  explanation: string;
}

export interface Subject {
  id: string;
  name: string;
  hasFormula: boolean;
}

export interface KnowledgePoint {
  id: string;
  subject: string;
  name: string;
  grade?: string;
  parentId?: string;
  children?: KnowledgePoint[];
  description?: string;
  commonProblemTypes?: string[];
  relatedFormulas?: string[];
}

// Tool input types
export interface WriteOutputInput {
  field: SyncField;
  value: unknown;
  preview: string;
}

export interface GetKnowledgePointsInput {
  subject: string;
  grade?: string;
  parentId?: string;
}

// Tool output types
export interface WriteOutputResult {
  data: {
    field: SyncField;
    value: unknown;
    preview: string;
  };
  status: 'success' | 'error';
}
