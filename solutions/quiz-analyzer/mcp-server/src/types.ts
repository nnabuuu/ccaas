// SYNC_FIELDS Definition
export const SYNC_FIELDS = [
  'quizAnalysis',          // Overall analysis summary (string, Markdown)
  'knowledgePointTags',    // Array of KnowledgePointTag
  'thinkingProcess',       // 思路 - How to approach (string, Markdown)
  'solutionSteps',         // Array of SolutionStep
  'correctAnswer',         // The answer (string)
  'commonMistakes',        // Array of Mistake
  'knowledgeGapAnalysis',  // Analysis of knowledge gaps (string, Markdown)
  'difficulty',            // Difficulty 1-5 (number)
  'relatedQuizzes',        // Array of RelatedQuiz
  'timeEstimate',          // Estimated solving time (string)
] as const;

export type SyncField = typeof SYNC_FIELDS[number];

// Type definitions
export interface KnowledgePointTag {
  id: string;
  name: string;
  confidence: number;      // 0.0-1.0
  verified: boolean;
  level: number;           // Tree depth
  path: string[];          // ["代数", "方程", "一元二次方程"]
}

export interface SolutionStep {
  stepNumber: number;
  title: string;
  description: string;
  formula?: string;
  reasoning: string;
  commonErrors: string[];
}

export interface Mistake {
  description: string;
  frequency: 'high' | 'medium' | 'low';
  knowledgeGaps: string[]; // Knowledge point IDs
  remediation: string;     // Suggested learning path
}

export interface RelatedQuiz {
  id: string;
  content: string;
  similarity: number;      // 0.0-1.0
  sharedKnowledgePoints: string[];
}

export interface WriteOutputInput {
  field: SyncField;
  value: unknown;
  preview: string;
}

export interface WriteOutputResult {
  status: 'success' | 'error';
  data?: {
    field: SyncField;
    value: unknown;
    preview: string;
  };
  error?: string;
}

export interface KnowledgePointNode {
  id: string;
  name: string;
  code?: string;
  level: number;
  gradeLevel?: string;
  children: KnowledgePointNode[];
}
