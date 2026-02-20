/**
 * Zod schemas for write_output field validation (lesson plan)
 * Copied from lesson-plan-designer/mcp-server/src/schemas.ts
 */

import { z } from 'zod';

// Lesson plan field schemas
const ObjectiveSchema = z.object({
  id: z.string().default(() => `obj-${Date.now()}`),
  description: z.string(),
  bloomLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']).default('understand'),
  assessmentCriteria: z.string().optional(),
});

const StandardSchema = z.object({
  id: z.string().default(() => `std-${Date.now()}`),
  code: z.string(),
  description: z.string(),
});

const MaterialSchema = z.object({
  id: z.string().default(() => `mat-${Date.now()}`),
  name: z.string(),
  type: z.enum(['textbook', 'handout', 'digital', 'manipulative', 'other']).default('other'),
  url: z.string().optional(),
  notes: z.string().optional(),
});

const ActivitySchema = z.object({
  id: z.string().default(() => `act-${Date.now()}`),
  title: z.string(),
  description: z.string(),
  duration: z.number().default(10),
  type: z.enum(['introduction', 'direct-instruction', 'guided-practice', 'independent-practice', 'group', 'assessment', 'closure']).default('direct-instruction'),
  instructions: z.array(z.string()).default([]),
  materials: z.array(z.string()).optional(),
  teacherNotes: z.string().optional(),
});

const AssessmentSchema = z.object({
  formative: z.array(z.string()).default([]),
  summative: z.array(z.string()).default([]),
  rubric: z.string().optional(),
});

const DifferentiationSchema = z.object({
  struggling: z.array(z.string()).default([]),
  onLevel: z.array(z.string()).default([]),
  advanced: z.array(z.string()).default([]),
  ell: z.array(z.string()).optional(),
  accommodations: z.array(z.string()).optional(),
});

// All lesson plan sync fields
export const LESSON_PLAN_SYNC_FIELDS = [
  'title', 'subject', 'gradeLevel', 'duration',
  'objectives', 'standards', 'materials', 'activities',
  'assessment', 'differentiation',
] as const;

// Problem explainer sync fields
export const PROBLEM_SYNC_FIELDS = [
  'problemAnalysis', 'keyKnowledge', 'solutionSteps',
  'answer', 'commonMistakes', 'relatedProblems',
  'hints', 'difficulty',
] as const;

// All sync fields combined
export const ALL_SYNC_FIELDS = [...LESSON_PLAN_SYNC_FIELDS, ...PROBLEM_SYNC_FIELDS] as const;
export type SyncField = (typeof ALL_SYNC_FIELDS)[number];

const fieldSchemaMap: Record<string, z.ZodType> = {
  title: z.string(),
  subject: z.string(),
  gradeLevel: z.string(),
  duration: z.string(),
  objectives: z.array(ObjectiveSchema),
  standards: z.array(StandardSchema),
  materials: z.array(MaterialSchema),
  activities: z.array(ActivitySchema),
  assessment: AssessmentSchema,
  differentiation: DifferentiationSchema,
  // Problem fields - less strict validation
  problemAnalysis: z.string(),
  keyKnowledge: z.array(z.string()),
  solutionSteps: z.union([z.array(z.string()), z.array(z.object({
    stepNumber: z.number(),
    description: z.string(),
    explanation: z.string(),
    formula: z.string().optional(),
  }))]),
  answer: z.string(),
  commonMistakes: z.array(z.string()),
  relatedProblems: z.array(z.string()),
  hints: z.string(),
  difficulty: z.number().min(1).max(5),
};

export interface ValidationResult {
  success: boolean;
  data?: unknown;
  fixed?: boolean;
  warnings?: string[];
  errors: string[];
}

export function validateAndFixField(field: string, value: unknown): ValidationResult {
  const schema = fieldSchemaMap[field];
  if (!schema) {
    return { success: false, errors: [`Unknown field: ${field}`] };
  }

  try {
    const data = schema.parse(value);
    return { success: true, data, fixed: false, warnings: [], errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { success: false, errors: [String(error)] };
  }
}
