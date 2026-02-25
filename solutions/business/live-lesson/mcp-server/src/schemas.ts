import { z } from 'zod';
import { SYNC_FIELDS, type SyncField } from './types.js';

const HighlightedNodeSchema = z.object({
  nodeId: z.string(),
  durationMs: z.number(),
  startedAt: z.number(),
  color: z.enum(['yellow', 'red', 'blue']),
});

const BoardStateSchema = z.object({
  lessonId: z.string(),
  visibleNodeIds: z.array(z.string()),
  highlightedNodes: z.array(HighlightedNodeSchema),
  currentPhase: z.string(),
});

const BeatStateSchema = z.object({
  currentBeatId: z.string().nullable(),
  currentBeatIndex: z.number(),
  totalBeats: z.number(),
  sectionId: z.string().nullable(),
});

const GlobalBoardOpSchema = z.object({
  nodeId: z.string(),
  op: z.enum(['reveal', 'highlight']),
});

// Field schemas map
export const FieldSchemas: Record<SyncField, z.ZodTypeAny> = {
  boardState: BoardStateSchema,
  teacherMessage: z.string(),
  beatState: BeatStateSchema,
  dynamicBoardActions: z.array(z.object({ type: z.string() }).passthrough()),
  globalBoardOps: z.array(GlobalBoardOpSchema),
  suggestedQuestions: z.object({
    questions: z.array(z.string().min(1)).min(1).max(10),
    selectionMode: z.enum(['single', 'multi']).default('single'),
  }),
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
