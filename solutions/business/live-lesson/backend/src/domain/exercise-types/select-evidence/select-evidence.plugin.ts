/**
 * SelectEvidencePlugin — DELEGATING plugin.
 *
 * Grading is implemented in `../graders/select-evidence.grader.ts` (source
 * of truth). This plugin owns the Zod schema, sanitize(), and the wiring
 * to SelectEvidenceGrader. Do not duplicate scoring logic here.
 *
 * Note: this is the only plugin whose sanitize() intentionally retains
 * answer-bearing fields (correctFunction, hint, kind/why) so the frontend
 * can perform client-side grading. See the comment in sanitize() for the
 * full keep-list and why.
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
import type { GradeResult } from '../../../schemas';
import type { ExerciseSpec } from '../../../schemas/exercise-spec.schema';
import { SelectEvidenceGrader } from './select-evidence.grader';

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

const SelectEvidenceAnswerKeySchema = z
  .object({
    type: z.literal('select-evidence'),
    functionOptions: z.array(z.string()).min(2),
    sections: z.array(SelectEvidenceSectionSchema).nonempty(),
    paragraphTokens: z.record(z.string(), z.array(ParagraphTokenSchema)).optional(),
  })
  .refine(
    (ak) => {
      const fnOpts = new Set(ak.functionOptions);
      return ak.sections.every((s) => fnOpts.has(s.correctFunction));
    },
    { message: 'select-evidence: correctFunction must be in functionOptions' },
  );

@Injectable()
@ExerciseType('select-evidence')
export class SelectEvidencePlugin implements ExerciseTypePlugin {
  readonly type = 'select-evidence';
  readonly answerKeySchema = SelectEvidenceAnswerKeySchema;
  private readonly legacyGrader = new SelectEvidenceGrader();

  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    // select-evidence: client-side grading — intentionally keep correctFunction,
    // hint, aiCorrect/aiPartial, and token kind/why for client-side use.
    const ak = ctx.answerKey;
    const rawSections = (ak.sections as Array<Record<string, unknown>>) || [];
    const sections = rawSections.map((s) => ({
      id: s.id as string,
      label: s.label as string,
      range: s.range as number[],
      correctFunction: s.correctFunction as string,
      ...(s.minHits != null && { minHits: s.minHits as number }),
      ...(s.hint && { hint: s.hint as string }),
      ...(s.hintZh && { hintZh: s.hintZh as string }),
      ...(s.aiCorrect && { aiCorrect: s.aiCorrect as string }),
      ...(s.aiPartial && { aiPartial: s.aiPartial as string }),
    }));

    let paragraphTokens: ExerciseSpec['paragraphTokens'];
    if (ak.paragraphTokens && typeof ak.paragraphTokens === 'object') {
      paragraphTokens = {};
      const rawTokens = ak.paragraphTokens as Record<string, Array<Record<string, unknown>>>;
      for (const [paraNum, tokens] of Object.entries(rawTokens)) {
        paragraphTokens[paraNum] = tokens.map((tok) => ({
          t: tok.t as string,
          ...(tok.kind && { kind: tok.kind as string }),
          ...(tok.why && { why: tok.why as string }),
        }));
      }
    }

    return {
      type: 'select-evidence',
      label: ctx.exerciseLabel || (ak.label as string) || '',
      functionOptions: ak.functionOptions as string[],
      sections,
      paragraphTokens,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grade(ctx: GradeContext): GradeResult {
    return this.legacyGrader.grade(ctx.key as any, ctx.data);
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    const sections = (ctx.key.sections as Array<Record<string, unknown>>) || [];
    const sectionsData = (ctx.data.sections as Record<string, Record<string, unknown>>) || {};
    return sections.map((s) => {
      const id = s.id as string;
      const sectionData = sectionsData[id];
      const functionCorrect =
        (sectionData?.function as string)?.toLowerCase() ===
        (s.correctFunction as string)?.toLowerCase();
      return {
        idx: id,
        correct: functionCorrect,
        ...(!functionCorrect && s.hint && { hint: s.hint }),
        ...(!functionCorrect && s.hintZh && { hintZh: s.hintZh }),
        ...(functionCorrect && s.aiCorrect && { aiMessage: s.aiCorrect }),
        ...(!functionCorrect && s.aiPartial && { aiMessage: s.aiPartial }),
      };
    });
  }

  // ── §14 L3: two-stage grade ──
  // Select-evidence is client-side / deterministic — picked-token comparison
  // against the sanitized answerKey. No LLM. buildGradePrompt returns [];
  // parseGradeResponse re-runs the deterministic grader.
  buildGradePrompt(_ctx: GradeContext): GradePromptSpec[] {
    return [];
  }

  parseGradeResponse(_responses: string[], ctx: GradeContext): GradeResult {
    return this.grade(ctx);
  }
}
