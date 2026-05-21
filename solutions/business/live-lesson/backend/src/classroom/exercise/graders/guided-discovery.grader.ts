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
  recognized?: string;
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
          return this.gradeBlanks(swapped, answers as Record<string, string>, stepDef, result.ocrCache);
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
    ocrCache?: Map<string, string>,
  ): Promise<{ ok: boolean; feedback?: string; ocrCache: Map<string, string> }> {
    const feedbacks: string[] = [];
    let allCorrect = true;
    const cache = ocrCache ?? new Map<string, string>();

    // Parallel vision calls for image blanks (skip if cached)
    const imageResults = new Map<string, ImageGradeResult>();
    await Promise.all(blanks.map(async (blank) => {
      const v = answers[blank.id];
      if (!v || !isDataUri(v)) return;
      if (cache.has(blank.id)) return;
      if (!this.aiPromptBuilder) return;
      const result = await this.gradeImageBlank(v, blank, stepDef);
      imageResults.set(blank.id, result);
      if (result.recognized) cache.set(blank.id, result.recognized);
    }));

    for (const blank of blanks) {
      const v = answers[blank.id];
      if (!v) {
        allCorrect = false;
        continue;
      }

      if (isDataUri(v)) {
        const imgResult = imageResults.get(blank.id);
        if (imgResult) {
          // Fresh vision result from this call
          if (!imgResult.correct) allCorrect = false;
          if (imgResult.feedback) feedbacks.push(imgResult.feedback);
        } else {
          // Cached OCR text (swappable retry path) or AI unavailable
          const cachedText = cache.get(blank.id);
          if (cachedText !== undefined) {
            if (!matchesAny(cachedText, blank.accepts)) {
              allCorrect = false;
              if (blank.rejects?.length && matchesAny(cachedText, blank.rejects) && blank.rejectHint) {
                feedbacks.push(blank.rejectHint);
              }
            }
          } else {
            allCorrect = false;
            feedbacks.push('图片识别服务不可用，请使用键盘输入');
          }
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
      ocrCache: cache,
    };
  }

  private async gradeImageBlank(
    imageUri: string,
    blank: BlankDef,
    stepDef: GuidedDiscoveryStep,
  ): Promise<ImageGradeResult> {
    const labelPart = blank.label ? `学生正在填写：${blank.label}` : `填空题（步骤：${stepDef.title}）`;

    const userText = `${labelPart}
请逐字忠实转录图片中所有未被划掉的手写内容，不要修正任何拼写或数学错误——即使你认为学生写错了也原样输出。
然后根据上述填写位置，提取对应的答案。
输出JSON：{ "allText": "所有转录出的内容，多行用\\n分隔", "recognized": "对应填写位置的表达式或文字" }`;

    try {
      const raw = await this.aiPromptBuilder!.callVisionLlm(
        '你是一个 OCR 文字提取工具。忠实转录图片中的手写内容，原样输出，不要修正任何错误。如果有涂改或划掉的内容，忽略被划掉的部分。',
        [
          { type: 'image_url', image_url: { url: imageUri } },
          { type: 'text', text: userText },
        ],
        { maxTokens: 200, temperature: 0, responseFormat: { type: 'json_object' }, model: 'qwen3-vl-plus' },
      );

      const cleaned = raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim();
      this.logger.debug(`Vision OCR raw response for blank ${blank.id}: ${cleaned}`);
      const parsed = JSON.parse(cleaned) as { allText?: string; recognized?: string };
      const recognized = parsed.recognized?.trim();
      const allText = parsed.allText?.trim();

      if (!recognized) {
        return { correct: false, feedback: '无法识别手写内容，请重新书写' };
      }

      if (matchesAny(recognized, blank.accepts)) {
        return { correct: true, recognized };
      }
      if (allText) {
        const lines = allText.split('\n').map(l => l.replace(/^[=＝]\s*/, '').trim()).filter(Boolean);
        if (lines.some(line => matchesAny(line, blank.accepts))) {
          return { correct: true, recognized };
        }
      }
      if (blank.rejects?.length && matchesAny(recognized, blank.rejects) && blank.rejectHint) {
        return { correct: false, feedback: blank.rejectHint, recognized };
      }
      const display = recognized.length > 50 ? recognized.slice(0, 50) + '…' : recognized;
      return { correct: false, feedback: `识别结果「${display}」不正确`, recognized };
    } catch (e) {
      this.logger.warn(`Vision grading failed for blank ${blank.id}: ${e}`);
      return { correct: false, feedback: '图片识别失败，请重新提交' };
    }
  }
}
