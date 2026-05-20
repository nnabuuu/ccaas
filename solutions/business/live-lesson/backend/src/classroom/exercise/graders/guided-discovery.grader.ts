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
          stepDef.blanks.map(b => ({ id: b.id, label: b.label, accepts: b.accepts, rejects: b.rejects })),
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

      case 'text_blanks':
        return this.gradeBlanks(
          stepDef.blanks.map(b => ({ id: b.id, accepts: b.accepts })),
          answers as Record<string, string>,
          stepDef,
        );

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
        if (!matchesAny(v, blank.accepts)) allCorrect = false;
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
    const rejectsPart = blank.rejects?.length ? `\n常见错误：${blank.rejects.join(', ')}` : '';

    const userText = `${labelPart}
正确答案（任一即可）：${blank.accepts.join(', ')}${rejectsPart}

请识别图片中的手写内容，判断是否与正确答案之一匹配。
输出JSON：{ "recognized": "识别出的表达式", "correct": true/false, "feedback": "简短反馈(20字内)" }`;

    try {
      const raw = await this.aiPromptBuilder!.callVisionLlm(
        '你是一位初中数学教师助手。请识别学生手写的数学表达式，判断是否与正确答案匹配。',
        [
          { type: 'image_url', image_url: { url: imageUri } },
          { type: 'text', text: userText },
        ],
        { maxTokens: 200, temperature: 0.1, responseFormat: { type: 'json_object' } },
      );

      const cleaned = raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim();
      const parsed = JSON.parse(cleaned) as { recognized?: string; correct?: boolean; feedback?: string };
      return {
        correct: parsed.correct === true,
        feedback: parsed.feedback,
      };
    } catch (e) {
      this.logger.warn(`Vision grading failed for blank ${blank.id}: ${e}`);
      return { correct: false, feedback: '图片识别失败，请重新提交' };
    }
  }
}
