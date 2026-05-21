import { Logger } from '@nestjs/common';
import type { Grader, GradeResult } from './grader.interface';
import type { GuidedDiscoveryAnswerKey, GuidedDiscoveryStep } from '../../../schemas';
import { matchesAny } from '../../../schemas/normalize-math';
import type { AiPromptBuilder } from '../../ai-prompt-builder';

function isDataUri(v: string): boolean {
  return v.startsWith('data:image/');
}

interface BlankDef {
  id: string;
  label?: string;
  accepts: string[];
  rejects?: string[];
  rejectHint?: string;
}

interface ImageGradeResult {
  correct: boolean;
  feedback?: string;
}

export class GuidedDiscoveryGrader implements Grader {
  private readonly logger = new Logger(GuidedDiscoveryGrader.name);

  constructor(private readonly aiPromptBuilder?: AiPromptBuilder) {}

  async grade(key: GuidedDiscoveryAnswerKey, data: Record<string, unknown>): Promise<GradeResult> {
    const stepsData = (data.steps ?? {}) as Record<string, Record<string, unknown>>;
    const byDimension: Record<string, boolean> = {};
    let correct = 0;
    const feedbacks: string[] = [];

    for (const stepDef of key.steps) {
      const sd = stepsData[stepDef.id] ?? {};
      const result = await this.gradeStep(stepDef, sd);
      byDimension[stepDef.id] = result.ok;
      if (result.ok) correct++;
      if (result.feedback) feedbacks.push(result.feedback);
    }

    const gradeResult: GradeResult = {
      total: key.steps.length > 0 ? Math.round((correct / key.steps.length) * 100) : 0,
      byDimension,
    };
    if (feedbacks.length > 0) {
      gradeResult.llmFeedback = feedbacks.join('\n');
    }
    return gradeResult;
  }

  private async gradeStep(
    stepDef: GuidedDiscoveryStep,
    sd: Record<string, unknown>,
  ): Promise<{ ok: boolean; feedback?: string }> {
    const answers = (sd.answers ?? {}) as Record<string, unknown>;

    switch (stepDef.type) {
      case 'observation_choice':
        return {
          ok: stepDef.choices.every(c => (answers as Record<string, number>)[c.id] === c.correct),
        };

      case 'formula_blanks':
        return this.gradeBlanks(
          stepDef.blanks.map(b => ({ id: b.id, label: b.label, accepts: b.accepts, rejects: b.rejects, rejectHint: b.rejectHint })),
          answers as Record<string, string>,
          stepDef,
        );

      case 'derivation_blank':
        return this.gradeBlanks(
          stepDef.lines
            .filter(line => line.blank)
            .map(line => ({ id: line.blank!.id, accepts: line.blank!.accepts })),
          answers as Record<string, string>,
          stepDef,
        );

      case 'text_blanks': {
        const blankDefs = stepDef.blanks.map(b => ({ id: b.id, accepts: b.accepts }));
        const result = await this.gradeBlanks(blankDefs, answers as Record<string, string>, stepDef);
        if (!result.ok && stepDef.swappable && blankDefs.length === 2) {
          const swapped = [
            { ...blankDefs[0], accepts: blankDefs[1].accepts },
            { ...blankDefs[1], accepts: blankDefs[0].accepts },
          ];
          return this.gradeBlanks(swapped, answers as Record<string, string>, stepDef);
        }
        return result;
      }

      default:
        return { ok: false };
    }
  }

  private async gradeBlanks(
    blanks: BlankDef[],
    answers: Record<string, string>,
    stepDef: GuidedDiscoveryStep,
  ): Promise<{ ok: boolean; feedback?: string }> {
    const feedbacks: string[] = [];
    let allCorrect = true;

    for (const blank of blanks) {
      const v = answers[blank.id];
      if (!v) {
        allCorrect = false;
        continue;
      }

      if (isDataUri(v)) {
        if (this.aiPromptBuilder) {
          const result = await this.gradeImageBlank(v, blank, stepDef);
          if (!result.correct) allCorrect = false;
          if (result.feedback) feedbacks.push(result.feedback);
        } else {
          this.logger.warn(`Image submitted for blank ${blank.id} but AI service unavailable`);
          allCorrect = false;
          feedbacks.push('图片识别服务不可用，请使用键盘输入');
        }
      } else {
        if (!matchesAny(v, blank.accepts)) {
          allCorrect = false;
          if (blank.rejects?.length && matchesAny(v, blank.rejects) && blank.rejectHint) {
            feedbacks.push(blank.rejectHint);
          }
        }
      }
    }

    return {
      ok: allCorrect,
      feedback: feedbacks.length > 0 ? feedbacks.join('; ') : undefined,
    };
  }

  private async gradeImageBlank(
    imageUri: string,
    blank: BlankDef,
    stepDef: GuidedDiscoveryStep,
  ): Promise<ImageGradeResult> {
    const labelPart = blank.label ? `学生正在填写：${blank.label}` : `填空题（步骤：${stepDef.title}）`;

    const userText = `${labelPart}
请识别图片中所有未被划掉的手写内容，然后根据上述填写位置，提取对应的答案。
输出JSON：{ "allText": "所有识别出的内容，多行用\\n分隔", "recognized": "对应填写位置的表达式或文字" }`;

    try {
      const raw = await this.aiPromptBuilder!.callVisionLlm(
        '你是一位数学手写识别助手。请准确识别图片中学生手写的所有数学表达式或文字。\n如果有涂改或划掉的内容，请忽略被划掉的部分。',
        [
          { type: 'image_url', image_url: { url: imageUri } },
          { type: 'text', text: userText },
        ],
        { maxTokens: 200, temperature: 0, responseFormat: { type: 'json_object' } },
      );

      const cleaned = raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim();
      const parsed = JSON.parse(cleaned) as { allText?: string; recognized?: string };
      const recognized = parsed.recognized?.trim();
      const allText = parsed.allText?.trim();

      if (!recognized) {
        return { correct: false, feedback: '无法识别手写内容，请重新书写' };
      }

      if (matchesAny(recognized, blank.accepts)) {
        return { correct: true };
      }
      if (allText) {
        const lines = allText.split('\n').map(l => l.replace(/^[=＝]\s*/, '').trim()).filter(Boolean);
        if (lines.some(line => matchesAny(line, blank.accepts))) {
          return { correct: true };
        }
      }
      if (blank.rejects?.length && matchesAny(recognized, blank.rejects) && blank.rejectHint) {
        return { correct: false, feedback: blank.rejectHint };
      }
      const display = recognized.length > 50 ? recognized.slice(0, 50) + '…' : recognized;
      return { correct: false, feedback: `识别结果「${display}」不正确` };
    } catch (e) {
      this.logger.warn(`Vision grading failed for blank ${blank.id}: ${e}`);
      return { correct: false, feedback: '图片识别失败，请重新提交' };
    }
  }
}
