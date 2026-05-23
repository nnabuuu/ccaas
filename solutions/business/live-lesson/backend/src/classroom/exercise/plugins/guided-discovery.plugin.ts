/**
 * GuidedDiscoveryPlugin — DELEGATING plugin.
 *
 * Grading is implemented in `../graders/guided-discovery.grader.ts` (source
 * of truth — implements the 4-step discovery rule: observation_choice →
 * formula_blanks → derivation_blank → text_blanks). This plugin owns the
 * Zod schema, sanitize(), and the wiring to GuidedDiscoveryGrader. Do not
 * duplicate the discovery scoring logic here.
 */
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
import type { GuidedDiscoveryAnswerKey } from '../../../schemas';
import type { ImageGradeResult } from '../graders/guided-discovery.grader';
import type { GradeResult } from '../../../schemas';
import type { ExerciseSpec } from '../../../schemas/exercise-spec.schema';
import { AiPromptBuilder } from '../../ai-prompt-builder';
import { GuidedDiscoveryGrader } from '../graders/guided-discovery.grader';

const InputMethodsSchema = z.array(z.enum(['keyboard', 'handwrite', 'photo'])).optional();

const GdObservationChoiceSchema = z.object({
  type: z.literal('observation_choice'),
  id: z.string().min(1),
  title: z.string(),
  table: z
    .array(z.object({ expression: z.string(), result: z.string() }))
    .optional(),
  highlights: z
    .object({
      same: z.object({ color: z.string(), terms: z.array(z.array(z.string())) }),
      opposite: z.object({ color: z.string(), terms: z.array(z.array(z.string())) }),
    })
    .optional(),
  choices: z
    .array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().optional(),
        options: z.array(z.string()).length(2),
        correct: z.number().int().min(0).max(1),
      }),
    )
    .nonempty(),
});

const GdFormulaBlanksSchema = z.object({
  type: z.literal('formula_blanks'),
  id: z.string().min(1),
  title: z.string(),
  prompt: z.string().optional(),
  layout: z.enum(['stacked', 'inline']).optional(),
  separator: z.string().optional(),
  blanks: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string(),
        placeholder: z.string().optional(),
        accepts: z.array(z.string()).nonempty(),
        rejects: z.array(z.string()).optional(),
        rejectHint: z.string().optional(),
        inputMethods: InputMethodsSchema,
      }),
    )
    .nonempty(),
  inputMethods: InputMethodsSchema,
});

const GdDerivationBlankSchema = z.object({
  type: z.literal('derivation_blank'),
  id: z.string().min(1),
  title: z.string(),
  hintSteps: z
    .array(
      z.object({
        title: z.string(),
        widget: z.enum(['formula-animation', 'solution-display', 'procedure-steps']).optional(),
        props: z.record(z.unknown()).optional(),
        hintZh: z.string().optional(),
      }),
    )
    .optional(),
  lines: z
    .array(
      z.object({
        text: z.string(),
        blank: z
          .object({
            id: z.string().min(1),
            placeholder: z.string().optional(),
            accepts: z.array(z.string()).nonempty(),
            inputMethods: InputMethodsSchema,
          })
          .optional(),
      }),
    )
    .nonempty(),
  inputMethods: InputMethodsSchema,
});

const GdTextBlanksSchema = z.object({
  type: z.literal('text_blanks'),
  id: z.string().min(1),
  title: z.string(),
  template: z.string().min(1),
  swappable: z.boolean().optional(),
  blanks: z
    .array(
      z.object({
        id: z.string().min(1),
        accepts: z.array(z.string()).nonempty(),
        inputMethods: InputMethodsSchema,
      }),
    )
    .nonempty(),
  inputMethods: InputMethodsSchema,
});

const GuidedDiscoveryStepSchema = z.discriminatedUnion('type', [
  GdObservationChoiceSchema,
  GdFormulaBlanksSchema,
  GdDerivationBlankSchema,
  GdTextBlanksSchema,
]);

const GuidedDiscoveryAnswerKeySchema = z.object({
  type: z.literal('guided-discovery'),
  title: z.string(),
  steps: z.array(GuidedDiscoveryStepSchema).nonempty(),
  summary: z
    .object({
      formula: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
});

@Injectable()
@ExerciseType('guided-discovery')
export class GuidedDiscoveryPlugin implements ExerciseTypePlugin {
  readonly type = 'guided-discovery';
  readonly answerKeySchema = GuidedDiscoveryAnswerKeySchema;
  private readonly legacyGrader: GuidedDiscoveryGrader;

  constructor(private readonly aiPromptBuilder: AiPromptBuilder) {
    this.legacyGrader = new GuidedDiscoveryGrader(aiPromptBuilder);
  }

  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    const ak = ctx.answerKey;
    const steps = (ak.steps || []) as Array<Record<string, unknown>>;
    return {
      type: 'guided-discovery',
      label: ctx.exerciseLabel || (ak.label as string) || '',
      gdTitle: ak.title as string,
      gdSteps: steps.map((step) => {
        const stepType = step.type as
          | 'observation_choice'
          | 'formula_blanks'
          | 'derivation_blank'
          | 'text_blanks';
        const base = { type: stepType, id: step.id as string, title: step.title as string };
        switch (stepType) {
          case 'observation_choice':
            return {
              ...base,
              table: step.table as Array<{ expression: string; result: string }> | undefined,
              highlights: step.highlights,
              choices: ((step.choices || []) as Array<Record<string, unknown>>).map((c) => ({
                id: c.id as string,
                prompt: c.prompt as string,
                options: c.options as string[],
                correct: c.correct as number,
              })),
              ...(step.conclusion && { conclusion: step.conclusion as string }),
            };
          case 'formula_blanks':
            return {
              ...base,
              ...(step.prompt && { prompt: step.prompt as string }),
              ...(step.layout && { layout: step.layout as 'stacked' | 'inline' }),
              ...(step.separator && { separator: step.separator as string }),
              blanks: ((step.blanks || []) as Array<Record<string, unknown>>).map((b) => ({
                id: b.id as string,
                label: b.label as string,
                ...(b.placeholder && { placeholder: b.placeholder as string }),
                ...(b.inputMethods && { inputMethods: b.inputMethods as string[] }),
              })),
              ...(step.inputMethods && { inputMethods: step.inputMethods as string[] }),
            };
          case 'derivation_blank':
            return {
              ...base,
              lines: ((step.lines || []) as Array<Record<string, unknown>>).map((l) => ({
                text: l.text as string,
                ...(l.blank && {
                  blank: {
                    id: (l.blank as Record<string, unknown>).id as string,
                    ...((l.blank as Record<string, unknown>).placeholder && {
                      placeholder: (l.blank as Record<string, unknown>).placeholder as string,
                    }),
                    ...((l.blank as Record<string, unknown>).inputMethods && {
                      inputMethods: (l.blank as Record<string, unknown>).inputMethods as string[],
                    }),
                  },
                }),
              })),
              ...(step.inputMethods && { inputMethods: step.inputMethods as string[] }),
              ...(step.hintSteps && {
                hintSteps: step.hintSteps as Array<{
                  title: string;
                  widget?: string;
                  props?: Record<string, unknown>;
                  hintZh?: string;
                }>,
              }),
            };
          case 'text_blanks':
            return {
              ...base,
              template: step.template as string,
              textBlanks: ((step.blanks || []) as Array<Record<string, unknown>>).map((b) => ({
                id: b.id as string,
                ...(b.inputMethods && { inputMethods: b.inputMethods as string[] }),
              })),
              ...(step.inputMethods && { inputMethods: step.inputMethods as string[] }),
            };
          default:
            return base;
        }
      }),
      ...(ak.summary && {
        gdSummary: ak.summary as { formula?: string; name?: string; description?: string },
      }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grade(ctx: GradeContext): Promise<GradeResult> {
    return this.legacyGrader.grade(ctx.key as any, ctx.data);
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    const steps = (ctx.key.steps as Array<Record<string, unknown>>) || [];
    const result: Array<Record<string, unknown>> = steps.map((s) => {
      const id = s.id as string;
      const val = ctx.gradeResult.byDimension?.[id];
      const correct = val === true || val === 100;
      return { idx: id, correct };
    });
    // Append the trailing _llm feedback item when present — matches the
    // legacy build-check-items.ts behavior for guided-discovery.
    if (ctx.gradeResult.llmFeedback) {
      result.push({ idx: '_llm', correct: true, hint: ctx.gradeResult.llmFeedback });
    }
    return result;
  }

  // ── §14 L3: two-stage grade ──
  // guided-discovery fires ONE vision-OCR LLM call per image blank in the
  // submission (0-N depending on which blanks use the photo input method).
  // L3 exposes one GradePromptSpec per blank carrying the TEXT portion of
  // the OCR prompt. Images aren't included in the spec — the inspector
  // can't re-upload them via editable JSON, but the system prompt + user
  // text + LLM response are all editable. The blank id is encoded in
  // `userMessage` so the inspector author can tell which blank is which.
  buildGradePrompt(ctx: GradeContext): GradePromptSpec[] {
    const key = ctx.key as unknown as GuidedDiscoveryAnswerKey;
    const prompts = this.legacyGrader.buildImageBlankPrompts(key, ctx.data);
    return prompts.map((p) => ({
      systemPrompt: p.systemPrompt,
      userMessage: `[step:${p.stepId} blank:${p.blankId}]\n\n${p.userText}`,
      options: {
        maxTokens: 200,
        temperature: 0,
        responseFormat: { type: 'json_object' },
      },
    }));
  }

  parseGradeResponse(responses: string[], ctx: GradeContext): GradeResult {
    const key = ctx.key as unknown as GuidedDiscoveryAnswerKey;
    const prompts = this.legacyGrader.buildImageBlankPrompts(key, ctx.data);
    const cache = new Map<string, ImageGradeResult>();
    for (let i = 0; i < prompts.length; i++) {
      const raw = responses[i];
      if (!raw) continue;
      cache.set(
        prompts[i].blankId,
        this.legacyGrader.parseImageBlankResponse(raw, prompts[i]),
      );
    }
    return this.legacyGrader.gradeWithImageBlankResponses(key, ctx.data, cache);
  }
}
