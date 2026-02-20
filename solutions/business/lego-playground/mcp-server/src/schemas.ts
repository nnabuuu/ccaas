import { z } from 'zod';

// Basic schemas
export const MosaicConfigSchema = z.object({
  widthStuds: z.number().min(8).max(128).default(48),
  heightStuds: z.number().min(8).max(128).default(48),
  layerCount: z.union([z.literal(2), z.literal(3)]).default(2),
  colorPalette: z.array(z.number()).default([]),
  brickPool: z.array(z.string()).default([]),
  resampling: z.enum(['lanczos', 'mitchell']).default('lanczos'),
  backgroundColor: z.string().default('#FFFFFF'),
});

export const PlacementSchema = z.object({
  brickId: z.string(),
  colorId: z.number(),
  x: z.number().min(0),
  y: z.number().min(0),
  layer: z.number().min(0),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
});

export const BillItemSchema = z.object({
  brickId: z.string(),
  colorId: z.number(),
  quantity: z.number().min(1),
});

export const LLMAssessmentSchema = z.object({
  overallScore: z.number().min(0).max(1),
  colorAccuracy: z.number().min(0).max(1),
  structuralIntegrity: z.number().min(0).max(1),
  visualAppeal: z.number().min(0).max(1),
  summary: z.string(),
  issues: z.array(z.string()).default([]),
  suggestions: z.array(z.object({
    type: z.enum(['color', 'placement', 'structure', 'coverage']),
    priority: z.number().min(1).max(5),
    description: z.string(),
  })).default([]),
});

export const IterationSummarySchema = z.object({
  iterationNumber: z.number().min(1),
  overallScore: z.number().min(0).max(1),
  decision: z.enum(['approve', 'reject', 'refine', 'pending']),
  feedback: z.string().optional(),
  timestamp: z.string(),
});

export const GenerationStatusSchema = z.object({
  phase: z.enum(['idle', 'analyzing', 'generating', 'assessing', 'complete', 'error']),
  progress: z.number().min(0).max(100),
  message: z.string(),
});

export const AssemblyGuideUrlSchema = z.string().url().or(z.string().min(1));

// Field schema mapping for write_output validation
export const FieldSchemas = {
  mosaicConfig: MosaicConfigSchema,
  placements: z.array(PlacementSchema),
  billOfMaterials: z.array(BillItemSchema),
  assessment: LLMAssessmentSchema,
  iterationHistory: z.array(IterationSummarySchema),
  generationStatus: GenerationStatusSchema,
  assemblyGuideUrl: AssemblyGuideUrlSchema,
} as const;

export type SyncFieldKey = keyof typeof FieldSchemas;

// Validation helper
export interface ValidationResult<T> {
  success: boolean;
  data: T | null;
  errors: string[];
  fixed: boolean;
}

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
        // Parse failed
      }
    }
  }
  return value;
}

export function validateAndFixField(
  field: string,
  value: unknown
): ValidationResult<unknown> {
  const schema = FieldSchemas[field as SyncFieldKey];
  if (!schema) {
    return {
      success: false,
      data: null,
      errors: [`Unknown field: ${field}`],
      fixed: false,
    };
  }

  const parsed = parseJsonSafely(value);
  const result = schema.safeParse(parsed);

  if (result.success) {
    const fixed = JSON.stringify(value) !== JSON.stringify(result.data);
    return { success: true, data: result.data, errors: [], fixed };
  }

  return {
    success: false,
    data: null,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    fixed: false,
  };
}
