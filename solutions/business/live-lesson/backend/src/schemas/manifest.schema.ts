import { z } from 'zod';
import { AnswerKeySchema } from './answer-key.schema';
import { BoardDataSchema } from './board-data.schema';
import { ObservationDefSchema } from './observation.schema';

// ── Segment (structured rich content) ──

const SegmentSchema = z.union([
  z.string(),
  z.object({ type: z.literal('math'), value: z.string() }),
  z.object({ type: z.literal('heading'), value: z.string() }),
  z.object({ type: z.literal('image'), src: z.string(), alt: z.string().optional(), width: z.number().optional() }),
  z.object({ type: z.literal('figure'), src: z.string(), alt: z.string().optional(), width: z.number().optional(), caption: z.string().optional(), math: z.string().optional() }),
]);

// ── Paragraph ──

const ParagraphSchema = z.object({
  id: z.string(),
  text: z.string(),
  content: z.array(SegmentSchema).optional(),
  role: z.enum(['key', 'detail']).optional(),
  highlights: z.array(z.string()).optional(),
  signals: z.array(z.string()).optional(),
});

// ── Article ──

const ArticleSchema = z.object({
  title: z.string(),
  source: z.string(),
  paragraphs: z.array(ParagraphSchema).min(1),
});

// ── StudentView (instruction / listen content) ──

const StudentViewSchema = z.object({
  title: z.string(),
  body: z.string(),
  keyPoints: z.array(z.string()).optional(),
  confirmLabel: z.string().optional(),
  ttsText: z.string().optional(),
});

// ── Discuss ──

const DiscussClusterSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
});

const FallbackMCSchema = z.object({
  question: z.string(),
  questionZh: z.string().optional(),
  options: z.array(z.string()).min(2),
  correctIndex: z.number().int().min(0),
  explanation: z.string(),
  explanationZh: z.string().optional(),
});

const DiscussSchema = z.object({
  openingQ: z.string(),
  openingQZh: z.string().optional(),
  goal: z.string(),
  systemPrompt: z.string(),
  scaffolds: z.array(z.string()).optional(),
  maxRounds: z.number().int().min(1).default(6),
  maxTimeSeconds: z.number().int().min(60).default(300),
  fallbackMC: FallbackMCSchema,
  insight: z.string(),
  insightZh: z.string().optional(),
  observe: z.array(z.string()).optional(),
  clusters: z.array(DiscussClusterSchema).optional(),
});

// ── PhaseConfig ──

const PhaseConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  unlockAfter: z.string().nullable(),
});

// ── TeacherView (passthrough — complex, teacher-only) ──

const TeacherViewSchema = z.object({
  speechLine: z.string(),
}).passthrough();

// ── ReadingStep ──

export const ReadingStepSchema = z.object({
  id: z.string(),
  idx: z.number(),
  type: z.enum(['task', 'instruction']).optional(),
  label: z.string(),
  labelEn: z.string().optional(),
  strategy: z.string().optional(),
  duration: z.number().optional(),
  description: z.string().optional(),
  focusParagraphs: z.array(z.string()).optional(),
  showRoles: z.boolean().optional(),
  // Task exercise fields
  exerciseLabel: z.string().optional(),
  subtitle: z.string().optional(),
  summary: z.string().optional(),
  answerKey: AnswerKeySchema.optional(),
  // Instruction / listen content
  studentView: StudentViewSchema.optional(),
  // AI assistant hint chips (per step)
  aiHints: z.array(z.object({
    q: z.string(),
    label: z.string(),
  })).optional(),
  // Discuss
  discuss: DiscussSchema.optional(),
  // Teacher
  teacherView: TeacherViewSchema.optional(),
  // Observe (declarative observability): array of $ref strings / inline defs, or single inline def
  observe: z.union([
    z.array(z.union([z.string(), ObservationDefSchema])),
    ObservationDefSchema,
  ]).optional(),
}).passthrough();

// ── PersonalTouch ──

const StrategyLabelSchema = z.object({
  taskIdx: z.number().int().positive(),
  strategy: z.string(),
  emoji: z.string(),
});

const TierSchema = z.object({
  minScore: z.number().min(0).max(100),
  label: z.string(),
  labelEn: z.string(),
  tone: z.enum(['gold', 'blue', 'neutral']),
});

export const PersonalTouchSchema = z.object({
  strategyLabels: z.array(StrategyLabelSchema).min(1),
  tiers: z.array(TierSchema).min(1),
});

// ── BonusArticle ──

const BonusParagraphSchema = z.object({
  id: z.string(),
  text: z.string(),
  role: z.enum(['introduction', 'example', 'conclusion']),
});

export const BonusArticleSchema = z.object({
  title: z.string(),
  paragraphs: z.array(BonusParagraphSchema).min(1),
});

// ── BonusStep ──

export const BonusStepSchema = z.object({
  idx: z.number().int(),
  type: z.literal('task'),
  label: z.string(),
  labelEn: z.string().optional(),
  strategy: z.string().optional(),
  exerciseLabel: z.string().optional(),
  answerKey: AnswerKeySchema,
});

// ── Manifest ──

export const ManifestSchema = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string(),
  gradeLevel: z.string(),
  lessonType: z.string(),
  teachingNotes: z.string().optional(),
  lessonIntro: z.string().optional(),
  lessonSummary: z.string().optional(),
  article: ArticleSchema,
  readingSteps: z.array(ReadingStepSchema).min(1),
  phaseConfig: z.array(PhaseConfigSchema).optional(),
  aiReferenceQA: z.array(z.object({
    q: z.string(), a: z.string(), category: z.string(),
  })).optional(),
  personalTouch: PersonalTouchSchema.optional(),
  bonusArticle: BonusArticleSchema.optional(),
  bonusSteps: z.array(BonusStepSchema).optional(),
  boardData: BoardDataSchema.optional(),
  observations: z.record(z.string(), ObservationDefSchema).optional(),
}).passthrough();

export type ReadingStep = z.infer<typeof ReadingStepSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type PersonalTouch = z.infer<typeof PersonalTouchSchema>;
export type BonusArticle = z.infer<typeof BonusArticleSchema>;
export type BonusStep = z.infer<typeof BonusStepSchema>;
export type Discuss = z.infer<typeof DiscussSchema>;
export type DiscussCluster = z.infer<typeof DiscussClusterSchema>;
export type FallbackMC = z.infer<typeof FallbackMCSchema>;
