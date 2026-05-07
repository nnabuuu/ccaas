/**
 * AnswerKey Zod schemas — discriminated union for all 6 exercise types.
 * Replaces the 278-line hand-written validator with declarative Zod schemas.
 */
import { z } from 'zod';

// ── Quiz ──

const QuizAnswerItemSchema = z.object({
  questionIdx: z.number(),
  questionText: z.string().min(1),
  questionTranslate: z.string().optional(),
  options: z.array(z.string()).min(2),
  correct: z.number().int().nonnegative(),
  label: z.string().optional(),
  hint: z.string().optional(),
  hintZh: z.string().optional(),
  walkthrough: z.string().optional(),
  walkthroughZh: z.string().optional(),
  paraRef: z.array(z.number().int().positive()).optional(),
});

const QuizAnswerKeySchema = z.object({
  type: z.literal('quiz'),
  answers: z.array(QuizAnswerItemSchema).nonempty(),
}).refine(
  (ak) => ak.answers.every((a) => a.correct < a.options.length),
  { message: 'quiz: correct index must be < options.length' },
);

// ── Match ──

const MatchAnswerItemSchema = z.object({
  pairIdx: z.number(),
  left: z.string().min(1),
  correct: z.string().min(1),
  options: z.array(z.string()).min(2).optional(),
  hint: z.string().optional(),
  hintZh: z.string().optional(),
  walkthrough: z.string().optional(),
  walkthroughZh: z.string().optional(),
  paraRef: z.array(z.number().int().positive()).optional(),
});

const MatchAnswerKeySchema = z.object({
  type: z.literal('match'),
  answers: z.array(MatchAnswerItemSchema).nonempty(),
  options: z.array(z.string()).min(2).optional(),
}).refine(
  (ak) => ak.answers.every((a) => a.options || ak.options),
  { message: 'match: each answer must have options at answer-level or top-level' },
);

// ── Matrix ──

const MatrixAnswerItemSchema = z.object({
  rowIdx: z.number(),
  place: z.string().min(1),
  isDemo: z.boolean().optional(),
  practice: z.string().optional(),
  reason: z.string().optional(),
  hint: z.string().optional(),
  hintZh: z.string().optional(),
  paraRef: z.array(z.number().int().positive()).optional(),
  whatPrompt: z.string().optional(),
  whyPrompt: z.string().optional(),
}).refine(
  (row) => row.isDemo || (row.practice && row.reason),
  { message: 'matrix: non-demo rows must have practice and reason' },
);

const MatrixAnswerKeySchema = z.object({
  type: z.literal('matrix'),
  answers: z.array(MatrixAnswerItemSchema).nonempty(),
  practiceCount: z.number().int().min(1).optional(),
});

// ── Stance ──

const StanceAnswerKeySchema = z.object({
  type: z.literal('stance'),
  validPositions: z.array(z.string()).min(1),
  minEvidence: z.number().int().min(1),
  stanceQ: z.string().optional(),
  stanceQZh: z.string().optional(),
  stanceOpts: z.array(z.string()).min(2),
  evidence: z.array(z.string()).min(1),
});

// ── Order ──

const OrderAnswerKeySchema = z.object({
  type: z.literal('order'),
  items: z.array(z.string()).min(2),
  correctOrder: z.array(z.number().int().nonnegative()),
}).refine(
  (ak) => ak.correctOrder.length === ak.items.length,
  { message: 'order: correctOrder.length must equal items.length' },
).refine(
  (ak) => ak.correctOrder.every((v) => v < ak.items.length),
  { message: 'order: correctOrder values must be < items.length' },
).refine(
  (ak) => new Set(ak.correctOrder).size === ak.items.length,
  { message: 'order: correctOrder must contain each index exactly once' },
);

// ── Select-Evidence ──

const SelectEvidenceSectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  range: z.array(z.number()).min(1),
  correctFunction: z.string().min(1),
  minHits: z.number().int().min(1).optional(),
  hint: z.string().optional(),
  hintZh: z.string().optional(),
  aiCorrect: z.string().optional(),
  aiPartial: z.string().optional(),
});

const ParagraphTokenSchema = z.object({
  t: z.string(),
  kind: z.string().optional(),
  why: z.string().optional(),
});

const SelectEvidenceAnswerKeySchema = z.object({
  type: z.literal('select-evidence'),
  functionOptions: z.array(z.string()).min(2),
  sections: z.array(SelectEvidenceSectionSchema).nonempty(),
  paragraphTokens: z.record(z.string(), z.array(ParagraphTokenSchema)).optional(),
}).refine(
  (ak) => {
    const fnOpts = new Set(ak.functionOptions);
    return ak.sections.every((s) => fnOpts.has(s.correctFunction));
  },
  { message: 'select-evidence: correctFunction must be in functionOptions' },
).refine(
  (ak) => {
    if (!ak.paragraphTokens) return true;
    const tokenParas = new Set(Object.keys(ak.paragraphTokens).map(Number));
    return ak.sections.every((s) =>
      s.range.every((paraNum) => tokenParas.has(paraNum)),
    );
  },
  { message: 'select-evidence: range paragraph must have entry in paragraphTokens' },
);

// ── Map ──

const MapAxisSchema = z.object({
  neg: z.string().min(1),
  pos: z.string().min(1),
  label: z.string().min(1),
});

const MapItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  hint: z.string().optional(),
  refs: z.array(z.number()).optional(),
});

const MapAnswerKeySchema = z.object({
  type: z.literal('map'),
  prompt: z.string().min(1),
  axes: z.object({ x: MapAxisSchema, y: MapAxisSchema }),
  items: z.array(MapItemSchema).min(1),
  expected: z.record(z.string(), z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1)])).optional(),
  minReasonLength: z.number().int().min(1).optional(),
  practiceCount: z.number().int().min(1).optional(),
  randomPractice: z.boolean().optional(),
});

// ── Discriminated Union ──
// Note: z.discriminatedUnion requires plain z.object schemas (no .refine).
// We use z.union instead since our schemas use .refine().

export const AnswerKeySchema = z.union([
  QuizAnswerKeySchema,
  MatchAnswerKeySchema,
  MatrixAnswerKeySchema,
  StanceAnswerKeySchema,
  OrderAnswerKeySchema,
  SelectEvidenceAnswerKeySchema,
  MapAnswerKeySchema,
]);

export type AnswerKey = z.infer<typeof AnswerKeySchema>;

// ── Per-type exports ──

export type QuizAnswerKey = z.infer<typeof QuizAnswerKeySchema>;
export type MatchAnswerKey = z.infer<typeof MatchAnswerKeySchema>;
export type MatrixAnswerKey = z.infer<typeof MatrixAnswerKeySchema>;
export type StanceAnswerKey = z.infer<typeof StanceAnswerKeySchema>;
export type OrderAnswerKey = z.infer<typeof OrderAnswerKeySchema>;
export type SelectEvidenceAnswerKey = z.infer<typeof SelectEvidenceAnswerKeySchema>;
export type MapAnswerKey = z.infer<typeof MapAnswerKeySchema>;

// ── Compatibility layer ──

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAnswerKey(ak: unknown): ValidationResult {
  const result = AnswerKeySchema.safeParse(ak);
  if (result.success) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  };
}
