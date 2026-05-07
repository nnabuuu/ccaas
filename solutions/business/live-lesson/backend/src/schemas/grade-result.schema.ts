import { z } from 'zod';

export const GradeResultSchema = z.object({
  total: z.number(),
  byDimension: z.record(z.string(), z.union([z.boolean(), z.number()])),
  attemptCounts: z.record(z.string(), z.number()).optional(),
  llmFeedback: z.string().optional(),
  llmItems: z.array(z.object({
    index: z.number(),
    relevant: z.boolean(),
    reason: z.string(),
  })).optional(),
  cellQualities: z.record(z.string(), z.object({
    whatQ: z.number(),
    whyQ: z.number(),
  })).optional(),
});

export type GradeResult = z.infer<typeof GradeResultSchema>;
