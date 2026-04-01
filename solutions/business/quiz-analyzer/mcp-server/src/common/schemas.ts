import { z } from 'zod';
import { SYNC_FIELDS, type SyncField, ErrorType } from './types.js';

// Individual field schemas
const KnowledgePointTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
  verified: z.boolean(),
  level: z.number().int().min(0),
  path: z.array(z.string()),
  note: z.string().optional(),  // Explanation when using parent node (fallback)
  source: z.enum(['question', 'solution', 'both']),  // Source of knowledge point identification
});

const SolutionStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  formula: z.string().optional(),
  reasoning: z.string().optional(),
  commonErrors: z.array(z.string()).optional(),
});

const ApproachPathSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  viability: z.enum(['viable', 'complex', 'dead_end']),
  reason: z.string().min(1),
});

const AnalysisStrategySchema = z.object({
  goal: z.string().min(1),
  goalDecomposition: z.string().min(1),
  approaches: z.array(ApproachPathSchema).min(1).max(5),
  chosenApproach: z.string().min(1),
  keyInsight: z.string().min(1),
});

const MistakeSchema = z.object({
  description: z.string().min(1),
  frequency: z.enum(['high', 'medium', 'low']),
  knowledgeGaps: z.array(z.string()),
  remediation: z.string().min(1),
});

const RelatedQuizSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  similarity: z.number().min(0).max(1),
  sharedKnowledgePoints: z.array(z.string()),
});

// KP Refinement result schema (CDBT output)
const KpRefinementTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  confidence: z.number().min(0).max(1),
  role: z.enum(['primary', 'secondary', 'tertiary']),
});

const KpRefinementResultSchema = z.object({
  tags: z.array(KpRefinementTagSchema).min(1).max(3),
  traversalType: z.string().min(1),
  tagCount: z.number().int().min(1).max(3),
  trace: z.record(z.unknown()),  // Loosely validated — complex nested structure
});

// JXGConstruction schemas (JSXGraph JSON serialization)
const ParentSchema = z.union([
  z.string(),
  z.number(),
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number(), z.number()]),
  z.object({ expr: z.string().min(1) }),
]);

const JXGElementSchema = z.object({
  type: z.string().min(1),
  parents: z.array(ParentSchema),
  attrs: z.record(z.unknown()),
  id: z.string().optional(),
});

const SnapValueSchema = z.object({
  value: z.number(), label: z.string(), note: z.string().optional(),
});

const AutoPlaySchema = z.object({
  fps: z.number().positive().optional(),
  duration: z.number().positive().optional(),
  mode: z.enum(['loop', 'bounce', 'once']).optional(),
});

const AnimationSpecSchema = z.object({
  param: z.string().min(1),
  range: z.tuple([z.number(), z.number()]).refine(
    ([a, b]) => a < b,
    { message: 'animation range[0] must be less than range[1]' },
  ),
  default: z.number(),
  label: z.string().optional(),
  snapValues: z.array(SnapValueSchema).optional(),
  autoPlay: AutoPlaySchema.optional(),
});

const JXGConstructionSchema = z.object({
  kind: z.enum(['2d', '3d']),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  bbox3d: z.tuple([
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number()]),
  ]).optional(),
  elements: z.array(JXGElementSchema).min(1),
  animation: AnimationSpecSchema.optional(),
});

// Field mapping
export const FieldSchemas: Record<SyncField, z.ZodTypeAny> = {
  quizAnalysis: z.string().min(1),
  knowledgePointTags: z.array(KnowledgePointTagSchema),
  thinkingProcess: z.string().min(1),
  solutionSteps: z.array(SolutionStepSchema),
  correctAnswer: z.union([z.string(), z.number()]).transform(v => String(v)).pipe(z.string().min(1)),
  analysisStrategy: AnalysisStrategySchema,
  commonMistakes: z.array(MistakeSchema),
  knowledgeGapAnalysis: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  difficultyAssessment: z.object({
    score: z.number().int().min(1).max(5),
    pitfalls: z.array(z.string().min(1)).min(1),
    reasoning: z.string().min(1),
  }),
  relatedQuizzes: z.array(RelatedQuizSchema),
  timeEstimate: z.string().min(1),
  timeAssessment: z.object({
    estimate: z.string().min(1),
    reasoning: z.string().min(1),
  }),
  kpRefinementResult: KpRefinementResultSchema,
  parsedContent: z.object({
    stem: z.string().min(1),
    options: z.array(z.string()),
    correctAnswer: z.string().optional(),
    quizType: z.enum(['choice', 'fill', 'subjective']),
  }),
  geometryFigure: JXGConstructionSchema,
  solutionGeometryFigure: JXGConstructionSchema,
  quickSummary: z.string().min(1),
};

// ============ ERROR TRACKING SCHEMAS (Error-Based Recommendation System) ============

const ErrorTypeEnum = z.nativeEnum(ErrorType);

export const ErrorStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  errorType: ErrorTypeEnum,
  errorDescription: z.string().min(1),
  affectedKnowledgePoints: z.array(z.string()),
  severity: z.enum(['critical', 'major', 'minor']),
  correctApproach: z.string().min(1),
});

export const StudentAnswerSchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  studentId: z.string().optional(),
  sessionId: z.string().uuid(),
  answerContent: z.string().min(1),
  stepsAttempted: z.array(z.string()).optional(),
  submittedAt: z.string().datetime(),
  isCorrect: z.boolean(),
  errorSteps: z.array(ErrorStepSchema),
});

const ErrorTypeMatchSchema = z.object({
  errorType: ErrorTypeEnum,
  frequency: z.number().int().min(0),
  exampleDescription: z.string(),
});

export const EnhancedRelatedQuizSchema = RelatedQuizSchema.extend({
  matchedErrorTypes: z.array(ErrorTypeMatchSchema),
  matchedErrorSteps: z.array(z.number().int().min(1)),
  errorSimilarityScore: z.number().min(0).max(1),
  knowledgePointSimilarityScore: z.number().min(0).max(1),
  overallSimilarityScore: z.number().min(0).max(1),
  recommendationReason: z.string().min(1),
});

export const ErrorPatternSchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  errorType: ErrorTypeEnum,
  stepNumber: z.number().int().min(1).nullable(),
  totalOccurrences: z.number().int().min(1),
  uniqueStudents: z.number().int().min(1),
  descriptions: z.array(z.string()),
  relatedKnowledgePoints: z.array(z.string()),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Validation function
export function validateAndFixField<T extends SyncField>(
  field: T,
  value: unknown
): { success: boolean; data: any; errors: string[]; fixed: boolean } {
  // Parse JSON strings if needed
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      // Keep as string if not JSON
    }
  }

  const schema = FieldSchemas[field];
  const result = schema.safeParse(parsed);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
      fixed: JSON.stringify(value) !== JSON.stringify(result.data),
    };
  } else {
    return {
      success: false,
      data: null,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      fixed: false,
    };
  }
}
