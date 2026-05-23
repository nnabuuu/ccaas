import { Injectable, Logger } from '@nestjs/common';
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
import { Inject } from '@nestjs/common';
import { LLM_PORT, type LlmPort } from '../../ports/llm.port';

const FillBlankBlankSchema = z.object({
  accepts: z.array(z.string()).nonempty(),
  hint: z.string().optional(),
});

const FillBlankSentenceSchema = z.object({
  id: z.string().min(1),
  template: z.string().min(1),
  blanks: z.record(z.string(), FillBlankBlankSchema),
});

const FillBlankAnswerKeySchema = z.object({
  type: z.literal('fill-blank'),
  sentences: z.array(FillBlankSentenceSchema).nonempty(),
});

type FillBlankKey = z.infer<typeof FillBlankAnswerKeySchema>;

@Injectable()
@ExerciseType('fill-blank')
export class FillBlankPlugin implements ExerciseTypePlugin {
  readonly type = 'fill-blank';
  readonly answerKeySchema = FillBlankAnswerKeySchema;
  private readonly logger = new Logger(FillBlankPlugin.name);

  constructor(@Inject(LLM_PORT) private readonly llm: LlmPort) {}

  sanitize(ctx: SanitizeContext): ExerciseSpec | null {
    const ak = ctx.answerKey;
    const sentences = (ak.sentences as Array<Record<string, unknown>>) || [];
    return {
      type: 'fill-blank',
      label: ctx.exerciseLabel || (ak.label as string) || '',
      sentences: sentences.map((s) => ({
        id: s.id as string,
        template: s.template as string,
      })),
    };
  }

  async grade(ctx: GradeContext): Promise<GradeResult> {
    const key = ctx.key as FillBlankKey;
    const studentBlanks = (ctx.data.blanks || {}) as Record<string, string>;
    const byDimension: Record<string, boolean> = {};
    let correct = 0;
    let total = 0;
    const pendingLlm: Array<{ dimKey: string; studentAnswer: string; accepts: string[] }> = [];

    for (const sentence of key.sentences) {
      for (const [blankId, blank] of Object.entries(sentence.blanks)) {
        const dimKey = `${sentence.id}_${blankId}`;
        total++;
        const studentAnswer = (studentBlanks[dimKey] || '').trim();

        if (!studentAnswer) {
          byDimension[dimKey] = false;
          continue;
        }

        const normalized = studentAnswer.toLowerCase();
        const isExact = blank.accepts.some((a) => a.trim().toLowerCase() === normalized);

        if (isExact) {
          byDimension[dimKey] = true;
          correct++;
        } else {
          pendingLlm.push({ dimKey, studentAnswer, accepts: blank.accepts });
        }
      }
    }

    if (pendingLlm.length > 0 && this.llm) {
      try {
        const llmResults = await this.checkSemanticEquivalence(pendingLlm);
        for (const { dimKey, equivalent } of llmResults) {
          byDimension[dimKey] = equivalent;
          if (equivalent) correct++;
        }
      } catch (e) {
        this.logger.warn(`LLM semantic check failed: ${e}`);
        for (const { dimKey } of pendingLlm) byDimension[dimKey] = false;
      }
    } else {
      for (const { dimKey } of pendingLlm) byDimension[dimKey] = false;
    }

    return {
      total: total > 0 ? Math.round((correct / total) * 100) : 0,
      byDimension,
    };
  }

  private async checkSemanticEquivalence(
    items: Array<{ dimKey: string; studentAnswer: string; accepts: string[] }>,
  ): Promise<Array<{ dimKey: string; equivalent: boolean }>> {
    const prompt = `判断每组中学生答案与标准答案是否语义等价。

${items.map((it, i) => `${i + 1}. 学生答案："${it.studentAnswer}"，标准答案：${it.accepts.map((a) => `"${a}"`).join('、')}`).join('\n')}

输出JSON：{ "results": [{ "index": 0, "equivalent": true/false }] }
仅判断语义是否等价，不要求完全相同的表述。`;

    const raw = await this.llm.callLlm(
      '你是一位教学评估助手。请严格判断语义等价性。',
      prompt,
      { maxTokens: 256, temperature: 0, responseFormat: { type: 'json_object' } },
    );

    let parsed: { results?: Array<{ index: number; equivalent: boolean }> };
    try {
      parsed = JSON.parse(raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim());
    } catch {
      this.logger.warn('LLM semantic check returned unparseable JSON');
      return items.map((it) => ({ dimKey: it.dimKey, equivalent: false }));
    }

    const results = parsed.results || [];
    return items.map((it, i) => {
      const found = results.find((r) => r.index === i);
      return { dimKey: it.dimKey, equivalent: found?.equivalent ?? false };
    });
  }

  buildCheckItems(ctx: CheckItemContext): Array<Record<string, unknown>> {
    // Legacy buildCheckItems didn't have a special case for fill-blank,
    // so return per-blank items based on byDimension
    const items: Array<Record<string, unknown>> = [];
    for (const [dimKey, val] of Object.entries(ctx.gradeResult.byDimension ?? {})) {
      const correct = val === true || val === 100;
      items.push({ idx: dimKey, correct });
    }
    return items;
  }

  // ── §14 L3: two-stage grade ──
  // Returns the pending LLM check (semantic equivalence) as a single prompt spec.
  // When all student answers match accepts[] exactly, returns an empty array
  // (no LLM call needed) and parseGradeResponse simply computes scores.
  buildGradePrompt(ctx: GradeContext): GradePromptSpec[] {
    const key = ctx.key as FillBlankKey;
    const studentBlanks = (ctx.data.blanks || {}) as Record<string, string>;
    const pending: Array<{ dimKey: string; studentAnswer: string; accepts: string[] }> = [];

    for (const sentence of key.sentences) {
      for (const [blankId, blank] of Object.entries(sentence.blanks)) {
        const dimKey = `${sentence.id}_${blankId}`;
        const studentAnswer = (studentBlanks[dimKey] || '').trim();
        if (!studentAnswer) continue;
        const normalized = studentAnswer.toLowerCase();
        const isExact = blank.accepts.some((a) => a.trim().toLowerCase() === normalized);
        if (!isExact) pending.push({ dimKey, studentAnswer, accepts: blank.accepts });
      }
    }
    if (pending.length === 0) return [];

    const userMessage = `判断每组中学生答案与标准答案是否语义等价。

${pending.map((it, i) => `${i + 1}. 学生答案："${it.studentAnswer}"，标准答案：${it.accepts.map((a) => `"${a}"`).join('、')}`).join('\n')}

输出JSON：{ "results": [{ "index": 0, "equivalent": true/false }] }
仅判断语义是否等价，不要求完全相同的表述。`;

    return [
      {
        systemPrompt: '你是一位教学评估助手。请严格判断语义等价性。',
        userMessage,
        options: { maxTokens: 256, temperature: 0, responseFormat: { type: 'json_object' } },
      },
    ];
  }

  parseGradeResponse(responses: string[], ctx: GradeContext): GradeResult {
    const key = ctx.key as FillBlankKey;
    const studentBlanks = (ctx.data.blanks || {}) as Record<string, string>;
    const byDimension: Record<string, boolean> = {};
    let correct = 0;
    let total = 0;
    const pendingIndices: string[] = [];

    for (const sentence of key.sentences) {
      for (const [blankId, blank] of Object.entries(sentence.blanks)) {
        const dimKey = `${sentence.id}_${blankId}`;
        total++;
        const studentAnswer = (studentBlanks[dimKey] || '').trim();
        if (!studentAnswer) {
          byDimension[dimKey] = false;
          continue;
        }
        const normalized = studentAnswer.toLowerCase();
        const isExact = blank.accepts.some((a) => a.trim().toLowerCase() === normalized);
        if (isExact) {
          byDimension[dimKey] = true;
          correct++;
        } else {
          pendingIndices.push(dimKey);
        }
      }
    }

    // Apply LLM response (if any)
    if (responses.length > 0 && pendingIndices.length > 0) {
      try {
        const raw = responses[0].replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim();
        const parsed = JSON.parse(raw) as {
          results?: Array<{ index: number; equivalent: boolean }>;
        };
        const results = parsed.results || [];
        pendingIndices.forEach((dimKey, i) => {
          const found = results.find((r) => r.index === i);
          const equivalent = found?.equivalent ?? false;
          byDimension[dimKey] = equivalent;
          if (equivalent) correct++;
        });
      } catch {
        for (const dimKey of pendingIndices) byDimension[dimKey] = false;
      }
    } else {
      for (const dimKey of pendingIndices) byDimension[dimKey] = false;
    }

    return {
      total: total > 0 ? Math.round((correct / total) * 100) : 0,
      byDimension,
    };
  }
}
