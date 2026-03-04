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
  'difficultyAssessment',  // Rich difficulty with pitfalls + reasoning
  'relatedQuizzes',        // Array of RelatedQuiz
  'timeEstimate',          // Estimated solving time (string)
  'timeAssessment',        // Rich time estimate with reasoning
  'kpRefinementResult',    // Complete KP refinement result (tags + trace + metadata)
  'parsedContent',         // Standardized parsed quiz content (stem, options, type)
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
  note?: string;           // Optional: Explanation when using parent node instead of leaf node
  source: 'question' | 'solution' | 'both';  // Where this knowledge point is identified from
  // 'question': Identified from the question text itself
  // 'solution': Identified from the answer/solution process
  // 'both': Required by both question context and solution method
}

export interface SolutionStep {
  stepNumber: number;
  title: string;
  description: string;
  formula?: string;
  reasoning: string;
  commonErrors: string[];
  relatedKnowledgePoints?: string[];  // 该步涉及的知识点名称
}

export interface TimeAssessment {
  estimate: string;       // "约 3-5 分钟"
  reasoning: string;      // "需要画辅助线+两次角度计算，计算量中等"
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

export interface KpRefinementTag {
  id: string;
  name: string;
  confidence: number;      // 0.0-1.0
  role: 'primary' | 'secondary' | 'tertiary';
}

export interface KpRefinementResult {
  tags: KpRefinementTag[];
  traversalType: string;
  tagCount: number;
  trace: Record<string, unknown>;
}

export interface ParsedContent {
  stem: string;
  options: string[];
  correctAnswer?: string;
  quizType: 'choice' | 'fill' | 'subjective';
}

export interface DifficultyAssessment {
  score: number;           // 1-5
  pitfalls: string[];      // 容易犯的错误
  reasoning: string;       // 为什么是这个难度
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

// ============ STUDENT ANSWER TRACKING (Error-Based Recommendation System) ============

/**
 * Predefined error type classification (Level 1)
 * Used for systematic error pattern analysis
 */
export enum ErrorType {
  CONCEPT_MISUNDERSTANDING = 'concept_misunderstanding',    // 概念理解错误
  CALCULATION_ERROR = 'calculation_error',                  // 计算错误
  FORMULA_MISUSE = 'formula_misuse',                       // 公式应用错误
  STEP_OMISSION = 'step_omission',                         // 步骤遗漏
  STEP_ORDER_WRONG = 'step_order_wrong',                   // 步骤顺序错误
  CONDITION_NEGLECT = 'condition_neglect',                 // 条件遗漏/忽略
  REASONING_ERROR = 'reasoning_error',                     // 推理错误
  SYMBOL_CONFUSION = 'symbol_confusion',                   // 符号混淆
  UNIT_CONVERSION_ERROR = 'unit_conversion_error',         // 单位换算错误
  RANGE_ERROR = 'range_error',                            // 取值范围错误
  SPECIAL_CASE_NEGLECT = 'special_case_neglect',          // 特殊情况遗漏
  OTHER = 'other'                                          // 其他（需补充描述）
}

/**
 * Individual error step in a student's solution
 * Represents a specific mistake at a specific step
 */
export interface ErrorStep {
  stepNumber: number;          // Which step in the solution (1-indexed)
  errorType: ErrorType;        // Level 1: Predefined category
  errorDescription: string;    // Level 2: Natural language description
  affectedKnowledgePoints: string[];  // Knowledge point IDs affected by this error
  severity: 'critical' | 'major' | 'minor';  // Impact on final answer
  correctApproach: string;     // What should have been done
}

/**
 * Complete student answer submission with error analysis
 */
export interface StudentAnswer {
  id: string;
  quizId: string;
  studentId?: string;          // Optional: for student-specific tracking
  sessionId: string;           // CCAAS session ID
  answerContent: string;       // Student's raw answer
  stepsAttempted?: string[];   // Student's solution steps (自然语言)
  submittedAt: string;         // ISO timestamp
  isCorrect: boolean;
  errorSteps: ErrorStep[];     // Where did they go wrong?
}

/**
 * Error type match information for recommendations
 */
export interface ErrorTypeMatch {
  errorType: ErrorType;
  frequency: number;           // How many students made this error
  exampleDescription: string;  // Example description from this error type
}

/**
 * Enhanced related quiz with error-based matching metadata
 * Extends original RelatedQuiz with error similarity information
 */
export interface EnhancedRelatedQuiz extends RelatedQuiz {
  // Original fields: id, content, similarity, sharedKnowledgePoints

  // New error-based matching fields
  matchedErrorTypes: ErrorTypeMatch[];   // Which error types match?
  matchedErrorSteps: number[];           // Which step positions match?
  errorSimilarityScore: number;          // 0.0-1.0 (error pattern similarity)
  knowledgePointSimilarityScore: number; // 0.0-1.0 (knowledge point similarity)
  overallSimilarityScore: number;        // 0.0-1.0 (weighted combination)
  recommendationReason: string;          // Natural language explanation
}

/**
 * Aggregated error pattern for a quiz
 * Used for statistical analysis and pattern detection
 */
export interface ErrorPattern {
  id: string;
  quizId: string;
  errorType: ErrorType;
  stepNumber: number | null;   // NULL means error not tied to specific step
  totalOccurrences: number;
  uniqueStudents: number;
  descriptions: string[];      // Collected natural language descriptions
  relatedKnowledgePoints: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
}
