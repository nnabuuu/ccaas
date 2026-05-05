import { z } from 'zod';

export const ExerciseSpecSchema = z.object({
  type: z.enum(['quiz', 'match', 'matrix', 'stance', 'order', 'select-evidence', 'map']),
  label: z.string(),
  // quiz
  questions: z.array(z.object({
    idx: z.number(),
    text: z.string(),
    translate: z.string().optional(),
    options: z.array(z.string()),
    paraRef: z.array(z.number()).optional(),
  })).optional(),
  // match
  pairs: z.array(z.object({
    idx: z.number(),
    left: z.string(),
    options: z.array(z.string()),
    paraRef: z.array(z.number()).optional(),
  })).optional(),
  // matrix
  rows: z.array(z.object({
    idx: z.number(),
    place: z.string(),
    isDemo: z.boolean(),
    practice: z.string().optional(),
    reason: z.string().optional(),
    paraRef: z.array(z.number()).optional(),
    whatPrompt: z.string().optional(),
    whyPrompt: z.string().optional(),
  })).optional(),
  practiceCount: z.number().optional(),
  // stance
  stanceQ: z.string().optional(),
  stanceQZh: z.string().optional(),
  stanceOpts: z.array(z.string()).optional(),
  evidence: z.array(z.string()).optional(),
  // order
  items: z.array(z.string()).optional(),
  // select-evidence
  functionOptions: z.array(z.string()).optional(),
  sections: z.array(z.object({
    id: z.string(),
    label: z.string(),
    range: z.array(z.number()),
    correctFunction: z.string().optional(),
    minHits: z.number().optional(),
    hint: z.string().optional(),
    hintZh: z.string().optional(),
    aiCorrect: z.string().optional(),
    aiPartial: z.string().optional(),
  })).optional(),
  paragraphTokens: z.record(z.string(), z.array(z.object({
    t: z.string(),
    interactive: z.boolean().optional(),
    kind: z.string().optional(),
    why: z.string().optional(),
  }))).optional(),
  // map
  prompt: z.string().optional(),
  axes: z.object({
    x: z.object({ neg: z.string(), pos: z.string(), label: z.string() }),
    y: z.object({ neg: z.string(), pos: z.string(), label: z.string() }),
  }).optional(),
  mapItems: z.array(z.object({
    id: z.string(),
    label: z.string(),
    hint: z.string().optional(),
    refs: z.array(z.number()).optional(),
  })).optional(),
  minReasonLength: z.number().optional(),
});

export type ExerciseSpec = z.infer<typeof ExerciseSpecSchema>;
