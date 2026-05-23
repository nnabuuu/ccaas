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

const StanceAnswerKeySchema = z.object({
  type: z.literal('stance'),
  validPositions: z.array(z.string()).min(1),
  minEvidence: z.number().int().min(1),
  stanceQ: z.string().optional(),
  stanceQZh: z.string().optional(),
  stanceOpts: z.array(z.string()).min(2),
  evidence: z.array(z.string()).min(1),
});

type StanceKey = z.infer<typeof StanceAnswerKeySchema>;

@Injectable()
@ExerciseType('stance')
export class StancePlugin implements ExerciseTypePlugin {
  readonly type = 'stance';
  readonly answerKeySchema = StanceAnswerKeySchema;

  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    const ak = ctx.answerKey;
    return {
      type: 'stance',
      label: ctx.exerciseLabel || (ak.label as string) || '',
      stanceQ: ak.stanceQ as string,
      stanceQZh: ak.stanceQZh as string | undefined,
      stanceOpts: ak.stanceOpts as string[],
      evidence: ak.evidence as string[],
    };
  }

  grade(ctx: GradeContext): GradeResult {
    const key = ctx.key as StanceKey;
    const validPositions = key.validPositions || [];
    const minEvidence = key.minEvidence || 2;
    const raw = ctx.data.position;

    let position: string;
    if (typeof raw === 'number') {
      position = (key.stanceOpts?.[raw] ?? '').toLowerCase();
    } else {
      position = String(raw ?? '').toLowerCase();
    }

    const evidence = (ctx.data.evidence || []) as unknown[];
    const hasValidPosition = validPositions.some((v) => v.toLowerCase() === position);
    const hasEnoughEvidence = Array.isArray(evidence) && evidence.length >= minEvidence;

    const byDimension: Record<string, boolean> = {
      position: hasValidPosition,
      evidence: hasEnoughEvidence,
    };

    const total =
      hasValidPosition && hasEnoughEvidence
        ? 100
        : hasValidPosition || hasEnoughEvidence
          ? 50
          : 0;
    return { total, byDimension };
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    const dimOk = (val: unknown): boolean => val === true || val === 100;
    const posCorrect = dimOk(ctx.gradeResult.byDimension?.position);
    const evCorrect = dimOk(ctx.gradeResult.byDimension?.evidence);
    return [
      { idx: 'position', correct: posCorrect },
      { idx: 'evidence', correct: evCorrect },
    ];
  }

  // ── §14 L3: two-stage grade ──
  // Stance validates position against validPositions[] + counts evidence
  // entries. No LLM involved. Inspector sees an empty prompt list.
  buildGradePrompt(_ctx: GradeContext): GradePromptSpec[] {
    return [];
  }

  parseGradeResponse(_responses: string[], ctx: GradeContext): GradeResult {
    return this.grade(ctx);
  }
}
