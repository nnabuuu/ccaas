/**
 * RichContentQuizPlugin — DELEGATING plugin.
 *
 * Grading composes the existing QuizGrader (text-based scoring) with
 * ImageUploadGrader (vision-based rubric) per-part. The per-modality
 * scoring rules are owned by those graders — this plugin's job is to
 * carry the rich-content schema, sanitize(), part-fanout, and the
 * wiring. No scoring logic should live in this file beyond aggregation.
 */
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ExerciseType } from '../exercise-type.decorator';
import type {
  ExerciseTypePlugin,
  GradeContext,
  CheckItemContext,
  SanitizeContext,
} from '../exercise-type-plugin.interface';
import type { GradeResult } from '../../../schemas';
import type { ExerciseSpec } from '../../../schemas/exercise-spec.schema';
import { AiPromptBuilder } from '../../ai-prompt-builder';
import { ImageUploadGrader } from '../graders/image-upload.grader';

const InputMethodsSchema = z.array(z.enum(['keyboard', 'handwrite', 'photo'])).optional();

const PromptImageSchema = z.object({
  url: z.string().min(1),
  alt: z.string().optional(),
});

const RubricItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0),
  criteria: z.string().min(1),
});

const ScaffoldStepSchema = z.object({
  title: z.string().min(1),
  hintZh: z.string().optional(),
  widget: z.enum(['formula-animation', 'solution-display', 'procedure-steps']).optional(),
  props: z.record(z.unknown()).optional(),
});

const ScaffoldLevelSchema = z.object({
  hintZh: z.string().min(1),
  hintImage: z.string().optional(),
  steps: z.array(ScaffoldStepSchema).optional(),
});

const ScaffoldSchema = z.object({
  threshold: z.number().int().min(0),
  levels: z.array(ScaffoldLevelSchema).nonempty(),
});

const RichContentPartSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  expression: z.string().optional(),
  rubric: z.array(RubricItemSchema).nonempty(),
  sampleSolution: z.string().optional(),
  maxImages: z.number().int().min(1).optional(),
  aiSystemPrompt: z.string().optional(),
  scaffold: ScaffoldSchema.optional(),
  inputMethods: InputMethodsSchema,
  accepts: z.array(z.string()).optional(),
});

const RichContentQuizAnswerKeySchema = z
  .object({
    type: z.literal('rich-content-quiz'),
    subType: z.enum(['calculation']).optional(),
    prompt: z.string().optional(),
    promptImages: z.array(PromptImageSchema).optional(),
    rubric: z.array(RubricItemSchema).optional(),
    sampleSolution: z.string().optional(),
    aiSystemPrompt: z.string().optional(),
    maxImages: z.number().int().min(1).optional(),
    parts: z.array(RichContentPartSchema).optional(),
    inputMethods: InputMethodsSchema,
  })
  .refine(
    (ak) => (ak.parts && ak.parts.length > 0) || (ak.rubric && ak.rubric.length > 0),
    { message: 'rich-content-quiz: must have either parts or rubric' },
  );

@Injectable()
@ExerciseType('rich-content-quiz')
export class RichContentQuizPlugin implements ExerciseTypePlugin {
  readonly type = 'rich-content-quiz';
  readonly answerKeySchema = RichContentQuizAnswerKeySchema;
  private readonly legacyGrader: ImageUploadGrader;

  constructor(private readonly aiPromptBuilder: AiPromptBuilder) {
    // rich-content-quiz reuses ImageUploadGrader (parts → image-upload semantics)
    this.legacyGrader = new ImageUploadGrader(aiPromptBuilder);
  }

  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    const ak = ctx.answerKey;
    const parts = ak.parts as Array<Record<string, unknown>> | undefined;
    if (parts && parts.length > 0) {
      return {
        type: 'rich-content-quiz',
        label: ctx.exerciseLabel || (ak.label as string) || '',
        ...(ak.subType && { subType: ak.subType as string }),
        ...(ak.maxImages && { maxImages: ak.maxImages as number }),
        ...(ak.inputMethods && { inputMethods: ak.inputMethods as string[] }),
        parts: parts.map((p) => ({
          id: p.id as string,
          prompt: p.prompt as string,
          ...(p.expression && { expression: p.expression as string }),
          rubric: ((p.rubric as Array<Record<string, unknown>>) || []).map((r) => ({
            id: r.id as string,
            label: r.label as string,
            weight: r.weight as number,
          })),
          ...(p.maxImages && { maxImages: p.maxImages as number }),
          ...(p.scaffold && { hasScaffold: true }),
          ...(p.inputMethods && { inputMethods: p.inputMethods as string[] }),
        })),
      };
    }
    // No parts: fall back to image-upload-style sanitize
    const rubric = (ak.rubric as Array<Record<string, unknown>>) || [];
    return {
      type: 'rich-content-quiz',
      label: ctx.exerciseLabel || (ak.label as string) || '',
      prompt: ak.prompt as string,
      ...(ak.promptImages && {
        promptImages: ak.promptImages as Array<{ url: string; alt?: string }>,
      }),
      rubric: rubric.map((r) => ({
        id: r.id as string,
        label: r.label as string,
        weight: r.weight as number,
      })),
      ...(ak.maxImages && { maxImages: ak.maxImages as number }),
      ...(ak.subType && { subType: ak.subType as string }),
      ...(ak.inputMethods && { inputMethods: ak.inputMethods as string[] }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grade(ctx: GradeContext): Promise<GradeResult> {
    return this.legacyGrader.grade(ctx.key as any, ctx.data);
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    const parts = ctx.key.parts as Array<Record<string, unknown>> | undefined;
    if (parts && parts.length > 0) {
      // Per-part item: correct if all rubric scores >= 80
      return parts.map((p) => {
        const id = p.id as string;
        const rubric = (p.rubric as Array<Record<string, unknown>>) || [];
        const allCorrect = rubric.every((r) => {
          const score = ctx.gradeResult.byDimension?.[`${id}.${r.id as string}`];
          return score === true || (typeof score === 'number' && score >= 80);
        });
        return { idx: id, correct: allCorrect };
      });
    }
    // Fall back: rubric-level items (same as image-upload)
    const rubric = (ctx.key.rubric as Array<Record<string, unknown>>) || [];
    return rubric.map((r) => {
      const id = r.id as string;
      const score = ctx.gradeResult.byDimension?.[id];
      const correct = score === true || (typeof score === 'number' && score >= 80);
      return { idx: id, correct };
    });
  }
}
