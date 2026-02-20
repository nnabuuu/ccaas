import { z } from 'zod';

// ============= Helper Functions =============

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============= Basic Field Schemas =============

export const ProblemAnalysisSchema = z.string().min(1, '题目分析不能为空');
export const AnswerSchema = z.string().min(1, '答案不能为空');
export const HintsSchema = z.string().default('');
export const DifficultySchema = z.number().min(1).max(5).default(3);

// ============= Array Field Schemas =============

export const KeyKnowledgeSchema = z.array(z.string()).default([]);
export const CommonMistakesSchema = z.array(z.string()).default([]);
export const RelatedProblemsSchema = z.array(z.string()).default([]);

// ============= SolutionStep Schema =============

export const SolutionStepSchema = z
  .object({
    id: z.string().optional(),
    stepNumber: z.number().min(1),
    description: z.string().min(1, '步骤描述不能为空'),
    formula: z.string().optional(),
    explanation: z.string().min(1, '步骤说明不能为空'),
  })
  .transform((obj) => ({
    ...obj,
    id: obj.id || generateId('step'),
  }));

export const SolutionStepsSchema = z.array(SolutionStepSchema).default([]);

// ============= Field Schema Mapping =============

export const FieldSchemas = {
  problemAnalysis: ProblemAnalysisSchema,
  keyKnowledge: KeyKnowledgeSchema,
  solutionSteps: SolutionStepsSchema,
  answer: AnswerSchema,
  commonMistakes: CommonMistakesSchema,
  relatedProblems: RelatedProblemsSchema,
  hints: HintsSchema,
  difficulty: DifficultySchema,
} as const;

export type SyncField = keyof typeof FieldSchemas;

// ============= Validation Types =============

export interface ValidationResult<T> {
  success: boolean;
  data: T | null;
  errors: string[];
  warnings: string[];
  fixed: boolean;
}

// ============= Validation Functions =============

/**
 * Safely parse JSON strings to objects/arrays.
 * Returns original value if parsing fails or not a JSON string.
 */
export function parseJsonSafely(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Parse failed, return original value
      }
    }
  }
  return value;
}

/**
 * Validate a value against a field schema.
 */
export function validateAndFix<T extends SyncField>(
  field: T,
  value: unknown
): ValidationResult<z.infer<(typeof FieldSchemas)[T]>> {
  const schema = FieldSchemas[field];
  if (!schema) {
    return {
      success: false,
      data: null,
      errors: [`Unknown field: ${field}`],
      warnings: [],
      fixed: false,
    };
  }

  const result = schema.safeParse(value);
  if (result.success) {
    // Check if data was auto-fixed (transformed)
    const fixed = JSON.stringify(value) !== JSON.stringify(result.data);
    return {
      success: true,
      data: result.data,
      errors: [],
      warnings: fixed ? [`Field ${field} data was auto-fixed`] : [],
      fixed,
    };
  }

  return {
    success: false,
    data: null,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    warnings: [],
    fixed: false,
  };
}

/**
 * Parse JSON string (if applicable) and validate field value.
 * This is the main entry point for validating write_output values.
 */
export function validateAndFixField<T extends SyncField>(
  field: T,
  value: unknown
): ValidationResult<z.infer<(typeof FieldSchemas)[T]>> {
  const parsed = parseJsonSafely(value);
  return validateAndFix(field, parsed);
}
