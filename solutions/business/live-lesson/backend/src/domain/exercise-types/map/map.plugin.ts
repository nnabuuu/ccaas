/**
 * MapPlugin — DELEGATING plugin.
 *
 * Grading is implemented in `../graders/map.grader.ts` (the source of truth).
 * This plugin owns the Zod schema, sanitize(), and the wiring to MapGrader —
 * no scoring logic in this file. If you change grading, edit MapGrader; the
 * plugin's parity spec only proves schema + sanitize + wiring are intact.
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
import type { GradeResult, MapAnswerKey } from '../../../schemas';
import type { ExerciseSpec } from '../../../schemas/exercise-spec.schema';
import { AiPromptBuilder } from '../../../classroom/ai-prompt-builder';
import { MapGrader } from './map.grader';

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
  expected: z
    .record(z.string(), z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1)]))
    .optional(),
  minReasonLength: z.number().int().min(1).optional(),
  practiceCount: z.number().int().min(1).optional(),
  randomPractice: z.boolean().optional(),
});

@Injectable()
@ExerciseType('map')
export class MapPlugin implements ExerciseTypePlugin {
  readonly type = 'map';
  readonly answerKeySchema = MapAnswerKeySchema;
  private readonly legacyGrader: MapGrader;

  constructor(private readonly aiPromptBuilder: AiPromptBuilder) {
    this.legacyGrader = new MapGrader(aiPromptBuilder);
  }

  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    const ak = ctx.answerKey;
    const rawAxes = ak.axes as Record<string, Record<string, string>> | undefined;
    const items = (ak.items as Array<Record<string, unknown>>) || [];
    const practiceCount = ak.practiceCount as number | undefined;
    const expected = ak.expected as Record<string, [number, number]> | undefined;
    const practiceItemIds = ctx.practiceItemIds;

    let givenPlacements: Record<string, { x: number; y: number }> | undefined;

    if (practiceItemIds && expected) {
      const practiceSet = new Set(practiceItemIds);
      givenPlacements = {};
      for (const it of items) {
        const id = it.id as string;
        if (!practiceSet.has(id) && expected[id]) {
          givenPlacements[id] = { x: expected[id][0], y: expected[id][1] };
        }
      }
    } else if (practiceCount && practiceCount < items.length && expected) {
      givenPlacements = {};
      for (let i = practiceCount; i < items.length; i++) {
        const id = items[i].id as string;
        if (expected[id]) {
          givenPlacements[id] = { x: expected[id][0], y: expected[id][1] };
        }
      }
    }

    return {
      type: 'map',
      label: ctx.exerciseLabel || (ak.label as string) || '',
      prompt: ak.prompt as string,
      axes: rawAxes
        ? {
            x: { neg: rawAxes.x.neg, pos: rawAxes.x.pos, label: rawAxes.x.label },
            y: { neg: rawAxes.y.neg, pos: rawAxes.y.pos, label: rawAxes.y.label },
          }
        : undefined,
      mapItems: items.map((it) => ({
        id: it.id as string,
        label: it.label as string,
        ...(it.hint && { hint: it.hint as string }),
        ...(it.refs && { refs: it.refs as number[] }),
      })),
      minReasonLength: (ak.minReasonLength as number) || 8,
      ...(practiceCount && { practiceCount }),
      ...(practiceItemIds && { practiceItemIds }),
      ...(givenPlacements &&
        Object.keys(givenPlacements).length > 0 && { givenPlacements }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grade(ctx: GradeContext): Promise<GradeResult> {
    return this.legacyGrader.grade(ctx.key as any, ctx.data);
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    const ak = ctx.key;
    const items = (ak.items as Array<Record<string, unknown>>) || [];
    const practiceCount = ak.practiceCount as number | undefined;
    const submittedPracticeIds = (ctx.data.practiceItemIds || []) as string[];
    const itemsToCheck =
      submittedPracticeIds.length > 0
        ? items.filter((it) => submittedPracticeIds.includes(it.id as string))
        : practiceCount
          ? items.slice(0, practiceCount)
          : items;

    // Per-item LLM commentary keyed by id (from MapGrader vision pass).
    const llmItemsMap = new Map<string, { relevant: boolean; comment: string }>();
    if (ctx.gradeResult.llmItems) {
      for (const li of ctx.gradeResult.llmItems) {
        if (li.id) llmItemsMap.set(li.id, { relevant: li.relevant, comment: li.reason });
      }
    }

    const result: Array<Record<string, unknown>> = itemsToCheck.map((it) => {
      const id = it.id as string;
      const placed = ctx.gradeResult.byDimension?.[`${id}_placed`] === true;
      const reasoned = ctx.gradeResult.byDimension?.[`${id}_reasoned`] === true;
      // Position score must clear 50/100 to count as correct — matches
      // the legacy build-check-items.ts behavior the registry replaces.
      const posScore = (ctx.gradeResult.byDimension?.[`${id}_positionScore`] as number) ?? 0;
      const llmItem = llmItemsMap.get(id);
      return {
        idx: id,
        correct: placed && reasoned && posScore >= 50,
        ...(llmItem?.comment && { hint: llmItem.comment }),
      };
    });

    if (ctx.gradeResult.llmFeedback) {
      result.push({ idx: '_llm', correct: true, hint: ctx.gradeResult.llmFeedback });
    }

    return result;
  }

  // ── §14 L3: two-stage grade ──
  // Map makes one LLM reason-evaluation call when ≥1 item has a reason long
  // enough to evaluate. The Inspector surfaces it as a single GradePromptSpec.
  // When no items qualify, buildGradePrompt returns [] and parseGradeResponse
  // falls back to pure rule-based scoring.
  buildGradePrompt(ctx: GradeContext): GradePromptSpec[] {
    const key = ctx.key as unknown as MapAnswerKey;
    const spec = this.legacyGrader.buildReasonEvalPrompt(key, ctx.data);
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
    const key = ctx.key as unknown as MapAnswerKey;
    const llmResult = responses.length > 0
      ? this.legacyGrader.parseReasonEvalResponse(responses[0])
      : null;
    return this.legacyGrader.gradeWithLlmEval(key, ctx.data, llmResult);
  }
}
