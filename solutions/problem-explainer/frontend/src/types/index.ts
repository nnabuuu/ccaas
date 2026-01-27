// Re-export event types from @ccaas/shared for type safety
export type {
  AgentStatusEvent,
  TextDeltaEvent,
  OutputUpdateEvent,
  ToolActivityEvent,
} from '@ccaas/shared';

// SYNC_FIELDS - Must match backend and MCP server definitions
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

export interface Explanation {
  problemAnalysis?: string;
  keyKnowledge: string[];
  solutionSteps: SolutionStep[];
  answer?: string;
  commonMistakes: string[];
  relatedProblems: string[];
  hints?: string;
  difficulty?: number;
}

export interface OutputUpdate {
  field: SyncField;
  value: unknown;
  preview: string;
  synced?: boolean;
  timestamp?: number;
}

export interface Problem {
  id: string;
  tenantId: string;
  content: string;
  imageUrl?: string;
  subject: string;
  gradeLevel?: string;
  problemType?: string;
  status: 'pending' | 'explaining' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  name: string;
  hasFormula: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isStreaming?: boolean;
}

export interface ChatState {
  messages: Message[];
  isConnected: boolean;
  isThinking: boolean;
  error?: string;
}

// Skill types
export interface Skill {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  prompt?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

// Field display configuration
export const FIELD_CONFIG: Record<SyncField, { label: string; icon: string }> = {
  problemAnalysis: { label: '题目分析', icon: '📋' },
  keyKnowledge: { label: '核心知识点', icon: '🎯' },
  solutionSteps: { label: '解题步骤', icon: '📝' },
  answer: { label: '答案', icon: '✅' },
  commonMistakes: { label: '易错点', icon: '⚠️' },
  relatedProblems: { label: '变式练习', icon: '🔄' },
  hints: { label: '提示', icon: '💡' },
  difficulty: { label: '难度', icon: '📊' },
};
