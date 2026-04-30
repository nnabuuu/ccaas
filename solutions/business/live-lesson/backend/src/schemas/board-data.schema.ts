import { z } from 'zod';

// ── Board Data (reusable — reading lessons, classroom state, etc.) ──

export const BoardBlockSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'heading', 'quote', 'chip-row', 'flow', 'matrix', 'mindmap',
    'compare', 'annotation', 'student-work', 'formula', 'image', 'divider',
  ]),
  region: z.enum(['L', 'C', 'R']).optional(),
  geometry: z.object({ col: z.number(), span: z.number() }).passthrough(),
  reveal: z.object({ step: z.number(), sub: z.number() }),
  data: z.record(z.unknown()),
}).passthrough();

export const BoardStepSchema = z.object({
  id: z.string(),
  idx: z.number(),
  label: z.string(),
}).passthrough();

export const BoardDataSchema = z.object({
  id: z.string(),
  lesson: z.object({ title: z.string() }).passthrough(),
  steps: z.array(BoardStepSchema),
  blocks: z.array(BoardBlockSchema),
}).passthrough();

export type BoardBlock = z.infer<typeof BoardBlockSchema>;
export type BoardStep = z.infer<typeof BoardStepSchema>;
export type BoardData = z.infer<typeof BoardDataSchema>;
