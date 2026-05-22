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

// ── Schema (mirrors QuizAnswerKeySchema in answer-key.schema.ts) ──

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

const QuizAnswerKeySchema = z
  .object({
    type: z.literal('quiz'),
    answers: z.array(QuizAnswerItemSchema).nonempty(),
  })
  .refine((ak) => ak.answers.every((a) => a.correct < a.options.length), {
    message: 'quiz: correct index must be < options.length',
  });

type QuizKey = z.infer<typeof QuizAnswerKeySchema>;

@Injectable()
@ExerciseType('quiz')
export class QuizPlugin implements ExerciseTypePlugin {
  readonly type = 'quiz';
  readonly answerKeySchema = QuizAnswerKeySchema;

  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    const ak = ctx.answerKey;
    const answers = ak.answers as Array<Record<string, unknown>> | undefined;
    return {
      type: 'quiz',
      label: ctx.exerciseLabel || (ak.label as string) || '',
      questions: (answers || []).map((a) => ({
        idx: a.questionIdx as number,
        text: a.questionText as string,
        ...(a.questionTranslate && { translate: a.questionTranslate as string }),
        options: (a.options as string[]) || [],
        ...(a.paraRef && { paraRef: a.paraRef as number[] }),
      })),
    };
  }

  grade(ctx: GradeContext): GradeResult {
    const key = ctx.key as QuizKey;
    const answers = key.answers || [];
    const studentAnswers = (ctx.data.answers || []) as unknown[];
    const byDimension: Record<string, boolean> = {};
    let correct = 0;

    for (const a of answers) {
      const studentAnswer = studentAnswers[a.questionIdx];
      const isCorrect = studentAnswer === a.correct;
      byDimension[`q${a.questionIdx}`] = isCorrect;
      if (isCorrect) correct++;
    }

    const total = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;

    const attemptCounts: Record<string, number> = {};
    const dataAttempts = ctx.data.attemptCounts as Record<string, number> | undefined;
    if (dataAttempts) {
      for (const a of answers) {
        attemptCounts[`q${a.questionIdx}`] = dataAttempts[a.questionIdx] ?? 1;
      }
    }

    return {
      total,
      byDimension,
      ...(Object.keys(attemptCounts).length > 0 && { attemptCounts }),
    };
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    const ak = ctx.key as QuizKey;
    const dimOk = (val: unknown): boolean => val === true || val === 100;
    return (ak.answers || []).map((a) => {
      const correct = dimOk(ctx.gradeResult.byDimension?.[`q${a.questionIdx}`]);
      return {
        idx: a.questionIdx,
        correct,
        ...(!correct && a.hint && { hint: a.hint }),
        ...(!correct && a.hintZh && { hintZh: a.hintZh }),
        ...(!correct && a.walkthrough && { walkthrough: a.walkthrough }),
        ...(!correct && a.walkthroughZh && { walkthroughZh: a.walkthroughZh }),
      };
    });
  }
}
