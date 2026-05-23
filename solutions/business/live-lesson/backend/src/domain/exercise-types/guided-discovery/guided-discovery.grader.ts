import { Logger } from '@nestjs/common';
import type { Grader, GradeResult } from '../../shared/grader.interface';
import type { GuidedDiscoveryAnswerKey, GuidedDiscoveryStep } from '../../../schemas';
import { matchesAny } from '../../../schemas/normalize-math';
import type { AiPromptBuilder } from '../../../classroom/ai-prompt-builder';

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

export interface ImageGradeResult {
  correct: boolean;
  feedback?: string;
  recognized?: string;
  /**
   * Raw multi-line OCR text. Kept on the cache so swappable retries (or
   * L3 rerun-with-different-accepts) can re-run the `allText` line-by-line
   * fallback against a new accepts list without firing the LLM again.
   */
  allText?: string;
}

/**
 * Description of one image-blank vision OCR call. Exposed for §14 L3 so
 * the admin Inspector can show the OCR prompt the grader would send for
 * each image blank and let an author edit-and-rerun the parse logic
 * without burning live LLM calls.
 *
 * `imageUri` is the actual image attachment used by `grade()`; L3
 * inspector callers can't edit it (no way to re-upload an image via
 * editable JSON) but can edit the `userText` and the LLM response JSON.
 */
export interface ImageBlankPromptSpec {
  stepId: string;
  blankId: string;
  blank: BlankDef;
  imageUri: string;
  systemPrompt: string;
  userText: string;
}

export class GuidedDiscoveryGrader implements Grader {
  private readonly logger = new Logger(GuidedDiscoveryGrader.name);
  private static readonly OCR_SYSTEM_PROMPT =
    '你是一个 OCR 文字提取工具。忠实转录图片中的手写内容，原样输出，不要修正任何错误。如果有涂改或划掉的内容，忽略被划掉的部分。';

  constructor(private readonly aiPromptBuilder?: AiPromptBuilder) {}

  async grade(key: GuidedDiscoveryAnswerKey, data: Record<string, unknown>): Promise<GradeResult> {
    // 1) Find every image blank in the submission and fire its OCR call in
    //    parallel. Text blanks are handled in step 2 without LLM.
    const prompts = this.buildImageBlankPrompts(key, data);
    const ocrCache = new Map<string, ImageGradeResult>();
    if (this.aiPromptBuilder && prompts.length > 0) {
      const responses = await Promise.all(
        prompts.map(async (p) => {
          try {
            const raw = await this.aiPromptBuilder!.callVisionLlm(
              p.systemPrompt,
              [
                { type: 'image_url', image_url: { url: p.imageUri } },
                { type: 'text', text: p.userText },
              ],
              { maxTokens: 200, temperature: 0, responseFormat: { type: 'json_object' }, model: 'qwen3-vl-plus' },
            );
            return raw;
          } catch (e) {
            this.logger.warn(`Vision grading failed for blank ${p.blankId}: ${e}`);
            return null;
          }
        }),
      );
      for (let i = 0; i < prompts.length; i++) {
        const raw = responses[i];
        const result =
          raw === null
            ? ({ correct: false, feedback: '图片识别失败，请重新提交' } as ImageGradeResult)
            : this.parseImageBlankResponse(raw, prompts[i]);
        ocrCache.set(prompts[i].blankId, result);
      }
    }

    // 2) Compose the final GradeResult given the OCR cache (or no cache when
    //    AI is unavailable).
    return this.gradeWithImageBlankResponses(key, data, ocrCache);
  }

  /**
   * §14 L3 — Stage 1: enumerate every image-blank OCR call the grader
   * would make for this submission. Pure: no LLM calls, no state mutation.
   * Returns the prompts in a stable order so callers can pair them up with
   * edited responses in stage 2.
   */
  buildImageBlankPrompts(
    key: GuidedDiscoveryAnswerKey,
    data: Record<string, unknown>,
  ): ImageBlankPromptSpec[] {
    const stepsData = (data.steps ?? {}) as Record<string, Record<string, unknown>>;
    const out: ImageBlankPromptSpec[] = [];
    for (const stepDef of key.steps) {
      const sd = stepsData[stepDef.id] ?? {};
      const answers = (sd.answers ?? {}) as Record<string, unknown>;
      const blanks = this.blanksForStep(stepDef);
      for (const blank of blanks) {
        const v = answers[blank.id];
        if (typeof v !== 'string' || !isDataUri(v)) continue;
        const labelPart = blank.label
          ? `学生正在填写：${blank.label}`
          : `填空题（步骤：${stepDef.title}）`;
        const userText = `${labelPart}
请逐字忠实转录图片中所有未被划掉的手写内容，不要修正任何拼写或数学错误——即使你认为学生写错了也原样输出。
然后根据上述填写位置，提取对应的答案。
输出JSON：{ "allText": "所有转录出的内容，多行用\\n分隔", "recognized": "对应填写位置的表达式或文字" }`;
        out.push({
          stepId: stepDef.id,
          blankId: blank.id,
          blank,
          imageUri: v,
          systemPrompt: GuidedDiscoveryGrader.OCR_SYSTEM_PROMPT,
          userText,
        });
      }
    }
    return out;
  }

  /**
   * §14 L3 — Stage 2 (per-prompt): parse a single OCR response into an
   * ImageGradeResult. Pure. Mirrors the production grader's accepts /
   * rejects / rejectHint logic so the edited path is byte-equivalent.
   */
  parseImageBlankResponse(rawResponse: string, prompt: ImageBlankPromptSpec): ImageGradeResult {
    let parsed: { allText?: string; recognized?: string };
    try {
      const cleaned = rawResponse.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Malformed LLM response is treated the same as a network failure
      // for student-facing feedback (matches the legacy single-try/catch
      // around the whole flow).
      return { correct: false, feedback: '图片识别失败，请重新提交' };
    }
    const recognized = parsed.recognized?.trim();
    const allText = parsed.allText?.trim();
    if (!recognized) {
      return { correct: false, feedback: '无法识别手写内容，请重新书写' };
    }

    if (matchesAny(recognized, prompt.blank.accepts)) {
      return { correct: true, recognized, ...(allText && { allText }) };
    }
    if (allText) {
      const lines = allText.split('\n').map((l) => l.replace(/^[=＝]\s*/, '').trim()).filter(Boolean);
      if (lines.some((line) => matchesAny(line, prompt.blank.accepts))) {
        return { correct: true, recognized, allText };
      }
    }
    if (prompt.blank.rejects?.length && matchesAny(recognized, prompt.blank.rejects) && prompt.blank.rejectHint) {
      return { correct: false, feedback: prompt.blank.rejectHint, recognized, ...(allText && { allText }) };
    }
    const display = recognized.length > 50 ? recognized.slice(0, 50) + '…' : recognized;
    return { correct: false, feedback: `识别结果「${display}」不正确`, recognized, ...(allText && { allText }) };
  }

  /**
   * §14 L3 — Stage 2 (compose): produce the final GradeResult given an
   * OCR cache (image blank → ImageGradeResult). Text blanks are graded
   * synchronously here. Pure — no LLM calls.
   */
  gradeWithImageBlankResponses(
    key: GuidedDiscoveryAnswerKey,
    data: Record<string, unknown>,
    ocrCache: Map<string, ImageGradeResult>,
  ): GradeResult {
    const stepsData = (data.steps ?? {}) as Record<string, Record<string, unknown>>;
    const byDimension: Record<string, boolean> = {};
    let correct = 0;
    const feedbacks: string[] = [];

    for (const stepDef of key.steps) {
      const sd = stepsData[stepDef.id] ?? {};
      const result = this.gradeStepSync(stepDef, sd, ocrCache);
      byDimension[stepDef.id] = result.ok;
      if (result.ok) correct++;
      if (result.feedback) feedbacks.push(result.feedback);
    }

    const gradeResult: GradeResult = {
      total: key.steps.length > 0 ? Math.round((correct / key.steps.length) * 100) : 0,
      byDimension,
    };
    if (feedbacks.length > 0) gradeResult.llmFeedback = feedbacks.join('\n');
    return gradeResult;
  }

  /**
   * Return the list of blank definitions for a step that participate in
   * the per-blank scoring (excludes purely choice-based steps).
   */
  private blanksForStep(stepDef: GuidedDiscoveryStep): BlankDef[] {
    switch (stepDef.type) {
      case 'formula_blanks':
        return stepDef.blanks.map((b) => ({
          id: b.id,
          label: b.label,
          accepts: b.accepts,
          rejects: b.rejects,
          rejectHint: b.rejectHint,
        }));
      case 'derivation_blank':
        return stepDef.lines
          .filter((line) => line.blank)
          .map((line) => ({ id: line.blank!.id, accepts: line.blank!.accepts }));
      case 'text_blanks':
        return stepDef.blanks.map((b) => ({ id: b.id, accepts: b.accepts }));
      default:
        return [];
    }
  }

  /**
   * Synchronous per-step grading that consults the OCR cache instead of
   * firing fresh LLM calls. Used by both grade() (after the parallel LLM
   * fan-out) and gradeWithImageBlankResponses (L3 replay).
   */
  private gradeStepSync(
    stepDef: GuidedDiscoveryStep,
    sd: Record<string, unknown>,
    ocrCache: Map<string, ImageGradeResult>,
  ): { ok: boolean; feedback?: string } {
    const answers = (sd.answers ?? {}) as Record<string, unknown>;

    switch (stepDef.type) {
      case 'observation_choice':
        return {
          ok: stepDef.choices.every(
            (c) => (answers as Record<string, number>)[c.id] === c.correct,
          ),
        };

      case 'formula_blanks':
      case 'derivation_blank':
        return this.gradeBlanksSync(this.blanksForStep(stepDef), answers as Record<string, string>, ocrCache);

      case 'text_blanks': {
        const blanks = this.blanksForStep(stepDef);
        const result = this.gradeBlanksSync(blanks, answers as Record<string, string>, ocrCache);
        if (!result.ok && stepDef.swappable && blanks.length === 2) {
          const swapped = [
            { ...blanks[0], accepts: blanks[1].accepts },
            { ...blanks[1], accepts: blanks[0].accepts },
          ];
          return this.gradeBlanksSync(swapped, answers as Record<string, string>, ocrCache);
        }
        return result;
      }

      default:
        return { ok: false };
    }
  }

  /**
   * Sync per-blank grading. Image blanks read from the OCR cache (built
   * by grade()'s LLM fan-out or supplied by L3 replay). Text blanks compare
   * directly against the accepts/rejects lists.
   */
  private gradeBlanksSync(
    blanks: BlankDef[],
    answers: Record<string, string>,
    ocrCache: Map<string, ImageGradeResult>,
  ): { ok: boolean; feedback?: string } {
    const feedbacks: string[] = [];
    let allCorrect = true;

    for (const blank of blanks) {
      const v = answers[blank.id];
      if (!v) {
        allCorrect = false;
        continue;
      }
      if (isDataUri(v)) {
        const cached = ocrCache.get(blank.id);
        if (!cached) {
          allCorrect = false;
          feedbacks.push('图片识别服务不可用，请使用键盘输入');
          continue;
        }
        // Re-evaluate the cached OCR output against the (possibly-swapped)
        // current blank's accepts. Mirrors parseImageBlankResponse: try
        // `recognized` first, then fall back to per-line allText. The
        // cache stores raw recognition text, not a baked score, so swap
        // retries and L3 reruns can reuse the same OCR cache.
        if (cached.recognized || cached.allText) {
          const directHit = cached.recognized && matchesAny(cached.recognized, blank.accepts);
          let allTextHit = false;
          if (!directHit && cached.allText) {
            const lines = cached.allText.split('\n').map((l) => l.replace(/^[=＝]\s*/, '').trim()).filter(Boolean);
            allTextHit = lines.some((line) => matchesAny(line, blank.accepts));
          }
          if (!(directHit || allTextHit)) {
            allCorrect = false;
            if (
              cached.recognized &&
              blank.rejects?.length &&
              matchesAny(cached.recognized, blank.rejects) &&
              blank.rejectHint
            ) {
              feedbacks.push(blank.rejectHint);
            } else if (cached.feedback) {
              feedbacks.push(cached.feedback);
            }
          }
        } else {
          // No recognition text → LLM call failed entirely. Trust the
          // cached failure feedback.
          if (!cached.correct) {
            allCorrect = false;
            if (cached.feedback) feedbacks.push(cached.feedback);
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
    };
  }
}
