import { z } from 'zod';

export const ExerciseSpecSchema = z.object({
  type: z.enum(['quiz', 'match', 'matrix', 'stance', 'order', 'select-evidence', 'map', 'image-upload', 'rich-content-quiz', 'fill-blank', 'guided-discovery']),
  subType: z.string().optional(),
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
  // map practiceCount + givenPlacements
  givenPlacements: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).optional(),
  practiceItemIds: z.array(z.string()).optional(),
  // image-upload
  promptImages: z.array(z.object({ url: z.string(), alt: z.string().optional() })).optional(),
  rubric: z.array(z.object({ id: z.string(), label: z.string(), weight: z.number() })).optional(),
  maxImages: z.number().optional(),
  // fill-blank
  sentences: z.array(z.object({
    id: z.string(),
    template: z.string(),
  })).optional(),
  // rich-content-quiz parts (student-safe: scaffold hints stripped)
  parts: z.array(z.object({
    id: z.string(),
    prompt: z.string(),
    rubric: z.array(z.object({ id: z.string(), label: z.string(), weight: z.number() })),
    maxImages: z.number().optional(),
    hasScaffold: z.boolean().optional(),
    inputMethods: z.array(z.string()).optional(),
  })).optional(),
  // rich-content-quiz top-level inputMethods default
  inputMethods: z.array(z.string()).optional(),
  // guided-discovery (student-safe: no correct/accepts/rejects)
  gdSteps: z.array(z.object({
    type: z.enum(['observation_choice', 'formula_blanks', 'derivation_blank', 'text_blanks']),
    id: z.string(),
    title: z.string(),
    table: z.array(z.object({ expression: z.string(), result: z.string() })).optional(),
    // highlights are pedagogical visual aids shown to the student, not answer data
    highlights: z.object({
      same: z.object({ color: z.string(), terms: z.array(z.array(z.string())) }),
      opposite: z.object({ color: z.string(), terms: z.array(z.array(z.string())) }),
    }).optional(),
    choices: z.array(z.object({
      id: z.string(),
      prompt: z.string(),
      options: z.array(z.string()),
    })).optional(),
    blanks: z.array(z.object({
      id: z.string(),
      label: z.string(),
      placeholder: z.string().optional(),
      inputMethods: z.array(z.string()).optional(),
    })).optional(),
    inputMethods: z.array(z.string()).optional(),
    lines: z.array(z.object({
      text: z.string(),
      blank: z.object({
        id: z.string(),
        placeholder: z.string().optional(),
        inputMethods: z.array(z.string()).optional(),
      }).optional(),
    })).optional(),
    template: z.string().optional(),
    textBlanks: z.array(z.object({ id: z.string(), inputMethods: z.array(z.string()).optional() })).optional(),
    prompt: z.string().optional(),
  })).optional(),
  gdTitle: z.string().optional(),
  gdSummary: z.object({
    formula: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
});

export type ExerciseSpec = z.infer<typeof ExerciseSpecSchema>;
