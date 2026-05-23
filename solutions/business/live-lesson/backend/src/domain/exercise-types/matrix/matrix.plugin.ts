/**
 * MatrixPlugin — DELEGATING plugin.
 *
 * Grading is implemented in `../graders/matrix.grader.ts` (the source of
 * truth). This plugin owns the Zod schema, sanitize(), and the wiring to
 * MatrixGrader inside grade()/buildCheckItems() — no scoring logic should
 * live in this file. If you change the grading rule, edit MatrixGrader and
 * keep `graders/matrix.grader.spec.ts` honest; the parity spec for this
 * plugin only proves schema + sanitize + wiring are intact (see
 * `plugins-stage2plus.spec.ts` header comment).
 */
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ExerciseType } from '../../shared/exercise-type.decorator';
import type {
  ExerciseTypePlugin,
  GradeContext,
  CheckItemContext,
  SanitizeContext,
  GradePromptSpec,
} from '../../shared/exercise-type-plugin.interface';
import type { GradeResult, MatrixAnswerKey } from '../../../schemas';
import type { ExerciseSpec } from '../../../schemas/exercise-spec.schema';
import { Inject } from '@nestjs/common';
import { LLM_PORT, type LlmPort } from '../../ports/llm.port';
import { MatrixGrader } from './matrix.grader';

const MatrixAnswerItemSchema = z
  .object({
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
  })
  .refine((row) => row.isDemo || (row.practice && row.reason), {
    message: 'matrix: non-demo rows must have practice and reason',
  });

const MatrixAnswerKeySchema = z.object({
  type: z.literal('matrix'),
  answers: z.array(MatrixAnswerItemSchema).nonempty(),
  practiceCount: z.number().int().min(1).optional(),
});

@Injectable()
@ExerciseType('matrix')
export class MatrixPlugin implements ExerciseTypePlugin {
  readonly type = 'matrix';
  readonly answerKeySchema = MatrixAnswerKeySchema;
  private readonly legacyGrader: MatrixGrader;

  constructor(@Inject(LLM_PORT) private readonly llm: LlmPort) {
    this.legacyGrader = new MatrixGrader(llm);
  }

  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    const ak = ctx.answerKey;
    const answers = (ak.answers as Array<Record<string, unknown>>) || [];
    return {
      type: 'matrix',
      label: ctx.exerciseLabel || (ak.label as string) || '',
      rows: answers.map((a) => ({
        idx: a.rowIdx as number,
        place: a.place as string,
        isDemo: !!a.isDemo,
        ...(a.practice && { practice: a.practice as string }),
        ...(a.reason && { reason: a.reason as string }),
        ...(a.paraRef && { paraRef: a.paraRef as number[] }),
        ...(a.whatPrompt && { whatPrompt: a.whatPrompt as string }),
        ...(a.whyPrompt && { whyPrompt: a.whyPrompt as string }),
      })),
      ...(ak.practiceCount && { practiceCount: ak.practiceCount as number }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grade(ctx: GradeContext): Promise<GradeResult> {
    return this.legacyGrader.grade(ctx.key as any, ctx.data);
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    const ak = ctx.key;
    const dimOk = (val: unknown): boolean => val === true || val === 100;
    const answers = (ak.answers as Array<Record<string, unknown>>) || [];
    return answers
      .filter((a) => !a.isDemo)
      .map((a) => {
        const place = ctx.gradeResult.byDimension?.place ?? 0;
        const practice = ctx.gradeResult.byDimension?.practice ?? 0;
        const reason = ctx.gradeResult.byDimension?.reason ?? 0;
        const correct = dimOk(place) && dimOk(practice) && dimOk(reason);
        return {
          idx: a.rowIdx,
          correct,
          ...(!correct && a.hint && { hint: a.hint }),
          ...(!correct && a.hintZh && { hintZh: a.hintZh }),
        };
      });
  }

  // ── §14 L3: two-stage grade ──
  // Matrix makes one LLM call (cell-quality scoring per row). The L3 inspector
  // surfaces it as a single GradePromptSpec; the prompt builder + response
  // parser live on MatrixGrader (single source of truth — production grade()
  // uses the same pair internally).
  buildGradePrompt(ctx: GradeContext): GradePromptSpec[] {
    const key = ctx.key as unknown as MatrixAnswerKey;
    const spec = this.legacyGrader.buildCellQualitiesPrompt(key, ctx.data);
    if (!spec) return [];
    return [
      {
        systemPrompt: spec.systemPrompt,
        userMessage: spec.userMessage,
        options: {
          maxTokens: spec.maxTokens,
          temperature: spec.temperature,
          responseFormat: { type: 'json_object' },
        },
      },
    ];
  }

  parseGradeResponse(responses: string[], ctx: GradeContext): GradeResult {
    const key = ctx.key as unknown as MatrixAnswerKey;
    // If there were no prompts (no non-demo rows), fall back to empty cell
    // qualities so the heuristic path runs end-to-end.
    const cellQualities = responses.length > 0
      ? this.legacyGrader.parseCellQualitiesResponse(responses[0], key, ctx.data)
      : {};
    return this.legacyGrader.gradeWithCellQualities(key, ctx.data, cellQualities);
  }
}
