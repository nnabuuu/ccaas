import { Logger } from '@nestjs/common';
import type { Grader, GradeResult } from '../../shared/grader.interface';
import type { FillBlankAnswerKey } from '../../../schemas';
import type { LlmPort } from '../../ports/llm.port';

export class FillBlankGrader implements Grader {
  private readonly logger = new Logger(FillBlankGrader.name);

  constructor(private readonly llm?: LlmPort) {}

  async grade(key: FillBlankAnswerKey, data: Record<string, unknown>): Promise<GradeResult> {
    const studentBlanks = (data.blanks || {}) as Record<string, string>;
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
        const isExact = blank.accepts.some(a => a.trim().toLowerCase() === normalized);

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
        for (const { dimKey } of pendingLlm) {
          byDimension[dimKey] = false;
        }
      }
    } else {
      for (const { dimKey } of pendingLlm) {
        byDimension[dimKey] = false;
      }
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

${items.map((it, i) => `${i + 1}. 学生答案："${it.studentAnswer}"，标准答案：${it.accepts.map(a => `"${a}"`).join('、')}`).join('\n')}

输出JSON：{ "results": [{ "index": 0, "equivalent": true/false }] }
仅判断语义是否等价，不要求完全相同的表述。`;

    const raw = await this.llm!.callLlm(
      '你是一位教学评估助手。请严格判断语义等价性。',
      prompt,
      { maxTokens: 256, temperature: 0, responseFormat: { type: 'json_object' } },
    );

    let parsed: { results?: Array<{ index: number; equivalent: boolean }> };
    try {
      parsed = JSON.parse(raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim());
    } catch {
      this.logger.warn('LLM semantic check returned unparseable JSON');
      return items.map(it => ({ dimKey: it.dimKey, equivalent: false }));
    }

    const results = parsed.results || [];
    return items.map((it, i) => {
      const found = results.find(r => r.index === i);
      return { dimKey: it.dimKey, equivalent: found?.equivalent ?? false };
    });
  }
}
