import { z } from 'zod';
import { SYNC_FIELDS, type SyncField } from './types.js';

// Individual field schemas
const KnowledgePointTagSchema = z.object({
  id: z.string().uuid(),
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
  reasoning: z.string().min(1),
  commonErrors: z.array(z.string()),
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

// Field mapping
export const FieldSchemas: Record<SyncField, z.ZodTypeAny> = {
  quizAnalysis: z.string().min(1),
  knowledgePointTags: z.array(KnowledgePointTagSchema),
  thinkingProcess: z.string().min(1),
  solutionSteps: z.array(SolutionStepSchema),
  correctAnswer: z.string().min(1),
  commonMistakes: z.array(MistakeSchema),
  knowledgeGapAnalysis: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  relatedQuizzes: z.array(RelatedQuizSchema),
  timeEstimate: z.string().min(1),
};

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
