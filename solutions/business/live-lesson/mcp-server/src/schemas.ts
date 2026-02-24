import { z } from 'zod';
import { SYNC_FIELDS, type SyncField } from './types.js';

const HighlightedNodeSchema = z.object({
  nodeId: z.string(),
  durationMs: z.number(),
  startedAt: z.number(),
  color: z.enum(['yellow', 'red', 'blue']),
});

const ActiveProbeSchema = z.object({
  id: z.string(),
  label: z.string(),
  confusionPointId: z.string(),
});

const BoardStateSchema = z.object({
  lessonId: z.string(),
  visibleNodeIds: z.array(z.string()),
  highlightedNodes: z.array(HighlightedNodeSchema),
  activeProbes: z.array(ActiveProbeSchema),
  currentPhase: z.string(),
});

// Field schemas map
export const FieldSchemas: Record<SyncField, z.ZodTypeAny> = {
  boardState: BoardStateSchema,
  teacherMessage: z.string(),
};

export function validateField(
  field: SyncField,
  value: unknown,
): { success: boolean; data: unknown; errors: string[] } {
  const schema = FieldSchemas[field];
  const result = schema.safeParse(value);

  if (result.success) {
    return { success: true, data: result.data, errors: [] };
  } else {
    return {
      success: false,
      data: null,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    };
  }
}
