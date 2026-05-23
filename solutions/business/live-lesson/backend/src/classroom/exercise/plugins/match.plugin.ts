import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ExerciseType } from '../exercise-type.decorator';
import type {
  ExerciseTypePlugin,
  GradeContext,
  CheckItemContext,
  SanitizeContext,
  GradePromptSpec,
} from '../exercise-type-plugin.interface';
import type { GradeResult } from '../../../schemas';
import type { ExerciseSpec } from '../../../schemas/exercise-spec.schema';

// ── Schema (mirrors MatchAnswerKeySchema in answer-key.schema.ts) ──

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

const MatchAnswerKeySchema = z
  .object({
    type: z.literal('match'),
    answers: z.array(MatchAnswerItemSchema).nonempty(),
    options: z.array(z.string()).min(2).optional(),
  })
  .refine((ak) => ak.answers.every((a) => a.options || ak.options), {
    message: 'match: each answer must have options at answer-level or top-level',
  });

type MatchKey = z.infer<typeof MatchAnswerKeySchema>;

@Injectable()
@ExerciseType('match')
export class MatchPlugin implements ExerciseTypePlugin {
  readonly type = 'match';
  readonly answerKeySchema = MatchAnswerKeySchema;

  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    const ak = ctx.answerKey;
    const answers = ak.answers as Array<Record<string, unknown>> | undefined;
    return {
      type: 'match',
      label: ctx.exerciseLabel || (ak.label as string) || '',
      pairs: (answers || []).map((a) => ({
        idx: a.pairIdx as number,
        left: a.left as string,
        options: (a.options as string[]) || (ak.options as string[]) || [],
        ...(a.paraRef && { paraRef: a.paraRef as number[] }),
      })),
    };
  }

  grade(ctx: GradeContext): GradeResult {
    const key = ctx.key as MatchKey;
    const answers = key.answers || [];
    const studentPairs = (ctx.data.pairs || ctx.data.answers || []) as unknown[];
    const byDimension: Record<string, boolean> = {};
    let correct = 0;

    for (const a of answers) {
      const studentPair = studentPairs[a.pairIdx] as string | { value?: string } | undefined;
      const studentValue =
        typeof studentPair === 'string' ? studentPair : studentPair?.value;
      const isCorrect = studentValue?.toLowerCase() === a.correct.toLowerCase();
      byDimension[`p${a.pairIdx}`] = isCorrect;
      if (isCorrect) correct++;
    }

    const total = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;

    const attemptCounts: Record<string, number> = {};
    const dataAttempts = ctx.data.attemptCounts as Record<string, number> | undefined;
    if (dataAttempts) {
      for (const a of answers) {
        attemptCounts[`p${a.pairIdx}`] = dataAttempts[a.pairIdx] ?? 1;
      }
    }

    return {
      total,
      byDimension,
      ...(Object.keys(attemptCounts).length > 0 && { attemptCounts }),
    };
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    const ak = ctx.key as MatchKey;
    const dimOk = (val: unknown): boolean => val === true || val === 100;
    return (ak.answers || []).map((a) => {
      const correct = dimOk(ctx.gradeResult.byDimension?.[`p${a.pairIdx}`]);
      return {
        idx: a.pairIdx,
        correct,
        ...(!correct && a.hint && { hint: a.hint }),
        ...(!correct && a.hintZh && { hintZh: a.hintZh }),
        ...(!correct && a.walkthrough && { walkthrough: a.walkthrough }),
        ...(!correct && a.walkthroughZh && { walkthroughZh: a.walkthroughZh }),
      };
    });
  }

  // ── §14 L3: two-stage grade ──
  // Match grading is a pure case-insensitive string comparison — no LLM call.
  // L3 inspector sees an empty prompt list; re-grade ignores the (empty)
  // responses and just re-runs the deterministic grader.
  buildGradePrompt(_ctx: GradeContext): GradePromptSpec[] {
    return [];
  }

  parseGradeResponse(_responses: string[], ctx: GradeContext): GradeResult {
    return this.grade(ctx);
  }
}
