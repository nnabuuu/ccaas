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
import type { GradeResult } from '../../../schemas';
import type { ExerciseSpec } from '../../../schemas/exercise-spec.schema';

// ── Schema (mirrors OrderAnswerKeySchema in answer-key.schema.ts) ──

const OrderAnswerKeySchema = z
  .object({
    type: z.literal('order'),
    items: z.array(z.string()).min(2),
    correctOrder: z.array(z.number().int().nonnegative()),
  })
  .refine((ak) => ak.correctOrder.length === ak.items.length, {
    message: 'order: correctOrder.length must equal items.length',
  })
  .refine((ak) => ak.correctOrder.every((v) => v < ak.items.length), {
    message: 'order: correctOrder values must be < items.length',
  })
  .refine((ak) => new Set(ak.correctOrder).size === ak.items.length, {
    message: 'order: correctOrder must contain each index exactly once',
  });

type OrderKey = z.infer<typeof OrderAnswerKeySchema>;

@Injectable()
@ExerciseType('order')
export class OrderPlugin implements ExerciseTypePlugin {
  readonly type = 'order';
  readonly answerKeySchema = OrderAnswerKeySchema;

  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    const ak = ctx.answerKey;
    return {
      type: 'order',
      label: ctx.exerciseLabel || (ak.label as string) || '',
      items: ak.items as string[],
    };
  }

  grade(ctx: GradeContext): GradeResult {
    const key = ctx.key as OrderKey;
    const items = key.items || [];
    const correctOrder = key.correctOrder || [];
    const studentOrder = (ctx.data.order || []) as Array<string | number | { label?: string }>;

    // correctOrder contains numeric indices into items[]; resolve to labels
    const correctLabels = correctOrder.map((idx) => items[idx] ?? '');

    const isCorrect =
      correctLabels.length === studentOrder.length &&
      correctLabels.every((label, idx) => {
        const raw = studentOrder[idx];
        const studentLabel =
          typeof raw === 'number'
            ? items[raw] ?? ''
            : typeof raw === 'string'
              ? raw
              : (raw as { label?: string })?.label ?? '';
        return studentLabel.toLowerCase() === label.toLowerCase();
      });

    return { total: isCorrect ? 100 : 0, byDimension: { correct: isCorrect } };
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    const ak = ctx.key as OrderKey;
    const orderItems = (ak.items || []).map(String);
    const correctOrder = ak.correctOrder || [];
    const studentOrder = (ctx.data.order || []) as unknown[];
    return correctOrder.map((expectedIdx, pos) => {
      const expectedLabel = (orderItems[expectedIdx] ?? '').toLowerCase();
      const raw = studentOrder[pos];
      const studentLabel =
        typeof raw === 'string'
          ? raw.toLowerCase()
          : typeof raw === 'number'
            ? (orderItems[raw] ?? '').toLowerCase()
            : '';
      return { idx: pos, correct: studentLabel === expectedLabel };
    });
  }

  // ── §14 L3: two-stage grade ──
  // Order is pure index/label comparison — no LLM call. buildGradePrompt
  // returns [] so the Inspector renders "no LLM prompts" instead of 400;
  // parseGradeResponse ignores responses and re-runs the deterministic
  // grader (grade is sync, so direct delegation is safe).
  buildGradePrompt(_ctx: GradeContext): GradePromptSpec[] {
    return [];
  }

  parseGradeResponse(_responses: string[], ctx: GradeContext): GradeResult {
    return this.grade(ctx);
  }
}
