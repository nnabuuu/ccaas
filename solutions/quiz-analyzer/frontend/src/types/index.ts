// Re-export common types from @ccaas/common if needed
export interface Subject {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface KnowledgePoint {
  id: string;
  subject_id: string;
  parent_id?: string;
  name: string;
  code?: string;
  description?: string;
  level: number;
  grade_level?: string;
  children?: KnowledgePoint[];
}

export interface Quiz {
  id: string;
  tenant_id: string;
  content: string;
  content_html?: string;
  subject_id: string;
  grade_level?: string;
  quiz_type?: string;
  difficulty?: number;
  source?: string;
  correct_answer?: string;
  answer_options?: string[];
  created_at: string;
  updated_at: string;
  subject?: Subject;
  knowledge_points?: KnowledgePoint[];
}

export interface KnowledgePointTag {
  id: string;
  name: string;
  confidence: number;
  verified: boolean;
  level: number;
  path: string[];
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
  knowledgeGaps: string[];
  remediation: string;
}

export interface QuizAnalysis {
  id: string;
  quiz_id: string;
  thinking_process?: string;
  solution_steps?: SolutionStep[];
  common_mistakes?: Mistake[];
  knowledge_gap_analysis?: string;
  difficulty_rationale?: string;
  time_estimate?: string;
  analyzed_at?: string;
  analyzer_version?: string;
}

export interface BatchJob {
  id: string;
  tenant_id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  quiz_ids: string[];
  total_count: number;
  completed_count: number;
  failed_count: number;
  started_at?: string;
  completed_at?: string;
  estimated_completion?: string;
  error_message?: string;
  results?: Array<{
    quizId: string;
    status: string;
    error?: string;
    duration_ms?: number;
  }>;
  created_at: string;
}

export interface SearchQuizzesParams {
  query?: string;
  subjectId?: string;
  gradeLevel?: string;
  quizType?: string;
  difficulty?: number;
  knowledgePointId?: string;
  limit?: number;
  offset?: number;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
