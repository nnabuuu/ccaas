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
  source?: 'question' | 'solution' | 'both';
}

export interface RelatedQuiz {
  id: string;
  content: string;
  similarity: number;
  similarityReason: string;
  matchedKnowledgePoints: string[];
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

// Difficulty Analysis - 深度文本化难度分析
export interface ChallengingAspect {
  aspect: string; // 挑战性方面
  description: string;
  difficulty: '低' | '中' | '高';
  affectedStudents: string;
}

export interface PrerequisiteKnowledge {
  topic: string;
  importance: '必需' | '重要' | '有帮助';
  lackImpact: string;
}

export interface TimeEstimate {
  fastLearner: string;
  averageLearner: string;
  slowLearner: string;
  rationale: string;
}

export interface SuitabilityInfo {
  gradeLevel: string;
  priorKnowledge: string;
  recommendedUse: string;
}

export interface DifficultyAnalysis {
  overview: string; // "简单" | "较易" | "中等" | "较难" | "困难"
  challengingAspects: ChallengingAspect[];
  prerequisiteKnowledge: PrerequisiteKnowledge[];
  commonDifficulties: string[];
  timeEstimate: TimeEstimate;
  suitableFor: SuitabilityInfo;
  teacherNotes?: string;
  studentNotes?: string;
}

/**
 * Complete Quiz Analysis with all 10 dimensions
 */
// Parsed Quiz structure (from parse_quiz_content tool)
export interface ParsedQuiz {
  stem: string
  options: string[]
  correctAnswer?: string
  quizType: 'choice' | 'fill' | 'subjective'
}

export interface QuizAnalysis {
  id: string;
  quiz_id: string;

  // 0. Parsed Quiz - 解析后的题目结构 (NEW)
  parsedQuiz?: ParsedQuiz;

  // 0.5. Catalog - 所属目录 (NEW)
  catalog?: {
    subjectId: string;
    path: string[];
  };

  // 0.6. Difficulty - 难度等级 (NEW, simple number)
  difficulty?: number;

  // 1. Overall Analysis - 整体分析
  quiz_analysis?: string;

  // 2. Knowledge Point Tags - 知识点标签
  knowledge_point_tags?: KnowledgePointTag[];
  knowledgePointTags?: KnowledgePointTag[]; // Alias for compatibility

  // 3. Thinking Process - 解题思路
  thinking_process?: string;

  // 4. Solution Steps - 解题步骤
  solution_steps?: SolutionStep[];

  // 5. Common Mistakes - 常见错误
  common_mistakes?: Mistake[];

  // 6. Knowledge Gap Analysis - 知识缺口分析
  knowledge_gap_analysis?: string;

  // 7. Difficulty Analysis - 深度难度分析（替代数值 difficulty）
  difficulty_analysis?: DifficultyAnalysis;

  // 8. Related Quizzes - 相关题目
  related_quizzes?: RelatedQuiz[];

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

// ============ ERROR-BASED RECOMMENDATION SYSTEM ============

export enum ErrorType {
  CONCEPT_MISUNDERSTANDING = 'concept_misunderstanding',
  CALCULATION_ERROR = 'calculation_error',
  FORMULA_MISUSE = 'formula_misuse',
  STEP_OMISSION = 'step_omission',
  STEP_ORDER_WRONG = 'step_order_wrong',
  CONDITION_NEGLECT = 'condition_neglect',
  REASONING_ERROR = 'reasoning_error',
  SYMBOL_CONFUSION = 'symbol_confusion',
  UNIT_CONVERSION_ERROR = 'unit_conversion_error',
  RANGE_ERROR = 'range_error',
  SPECIAL_CASE_NEGLECT = 'special_case_neglect',
  OTHER = 'other'
}

export interface ErrorStep {
  stepNumber: number;
  errorType: ErrorType;
  errorDescription: string;
  affectedKnowledgePoints: string[];
  severity: 'critical' | 'major' | 'minor';
  correctApproach: string;
}

export interface StudentAnswer {
  id: string;
  quizId: string;
  studentId?: string;
  sessionId: string;
  answerContent: string;
  stepsAttempted?: string[];
  submittedAt: string;
  isCorrect: boolean;
  errorSteps: ErrorStep[];
}

export interface ErrorTypeMatch {
  errorType: ErrorType;
  frequency: number;
  exampleDescription: string;
}

export interface EnhancedRelatedQuiz {
  id: string;
  content: string;
  similarity: number;
  sharedKnowledgePoints: string[];
  matchedErrorTypes: ErrorTypeMatch[];
  matchedErrorSteps: number[];
  errorSimilarityScore: number;
  knowledgePointSimilarityScore: number;
  overallSimilarityScore: number;
  recommendationReason: string;
}

export interface ErrorPattern {
  id: string;
  quizId: string;
  errorType: ErrorType;
  stepNumber: number | null;
  totalOccurrences: number;
  uniqueStudents: number;
  descriptions: string[];
  relatedKnowledgePoints: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
}

export interface ErrorStatistics {
  totalAttempts: number;
  correctRate: number;
  errorPatterns: Array<{
    errorType: ErrorType;
    stepNumber: number | null;
    occurrences: number;
    percentage: number;
    topDescriptions: string[];
    relatedKnowledgePoints: string[];
  }>;
}
