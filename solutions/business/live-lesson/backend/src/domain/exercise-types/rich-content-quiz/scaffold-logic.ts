/**
 * Pure scaffold-level computation for rich-content-quiz parts.
 *
 * Decides what scaffold (hint) response, if any, to surface after a graded
 * part submission, and whether the part should be marked completed.
 *
 * The classroom submit flow (`StudentSubmissionService.submitPart`) and the
 * task-demo submit flow (`TaskDemoService.submitPart`) both call this; the
 * two flows differ only in storage model (UPSERT vs append-only INSERT),
 * not in the scaffold rules.
 */

import type { RichContentPart } from '../../../schemas';

export interface ScaffoldResponse {
  level: number;
  hintZh: string;
  hintImage?: string;
  canRetry: boolean;
  steps?: Array<{
    title: string;
    hintZh?: string;
    widget?: string;
    props?: Record<string, unknown>;
  }>;
}

export interface ScaffoldComputationInput {
  partDef: RichContentPart;
  /** Highest scaffold level already shown (-1 if never wrong before). */
  prevScaffoldLevel: number;
  /** Whether the just-graded submission scored 100. */
  isCorrect: boolean;
  /** Optional LLM feedback text — used when partDef has no scaffold configured. */
  llmFeedback?: string;
}

export interface ScaffoldComputationResult {
  /** Null when no scaffold should be surfaced (correct, or all levels exhausted). */
  scaffold: ScaffoldResponse | null;
  /** Whether the part is now considered complete. */
  completed: boolean;
  /** The level to persist back to partsProgress (may equal prev if unchanged). */
  nextScaffoldLevel: number;
}

/**
 * Decide scaffold response + completion after a graded part submission.
 *
 *   correct                                    → { scaffold: null, completed: true }
 *   wrong + has scaffold + more levels         → { scaffold: levelN+1, completed: false }
 *   wrong + has scaffold + all levels shown    → { scaffold: null, completed: true }
 *                                                 (scaffold exhausted → give up)
 *   wrong + no scaffold configured             → { scaffold: synthesised-from-llmFeedback,
 *                                                  completed: false }
 */
export function computeScaffoldResponse(
  input: ScaffoldComputationInput,
): ScaffoldComputationResult {
  const { partDef, prevScaffoldLevel, isCorrect, llmFeedback } = input;

  if (isCorrect) {
    return { scaffold: null, completed: true, nextScaffoldLevel: prevScaffoldLevel };
  }

  // Wrong answer
  if (partDef.scaffold) {
    const nextLevel = prevScaffoldLevel + 1;
    if (nextLevel < partDef.scaffold.levels.length) {
      const isLastLevel = nextLevel === partDef.scaffold.levels.length - 1;
      const levelDef = partDef.scaffold.levels[nextLevel];
      return {
        scaffold: {
          level: nextLevel,
          hintZh: levelDef.hintZh,
          hintImage: levelDef.hintImage,
          canRetry: !isLastLevel,
          steps: levelDef.steps as ScaffoldResponse['steps'],
        },
        completed: false,
        nextScaffoldLevel: nextLevel,
      };
    }
    // All levels exhausted — mark as completed (scaffold gave up)
    return { scaffold: null, completed: true, nextScaffoldLevel: prevScaffoldLevel };
  }

  // No scaffold defined — synthesise a basic retry scaffold from LLM feedback.
  // Bump nextScaffoldLevel to 0 so downstream guards ("scaffold has been
  // shown to the student, _pass is allowed") work for parts without a
  // configured scaffold ladder too.
  return {
    scaffold: {
      level: 0,
      hintZh: llmFeedback || '答案不正确，请重新检查你的计算过程。',
      canRetry: true,
    },
    completed: false,
    nextScaffoldLevel: Math.max(prevScaffoldLevel, 0),
  };
}
