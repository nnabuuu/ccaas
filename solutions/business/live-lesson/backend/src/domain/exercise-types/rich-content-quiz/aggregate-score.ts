/**
 * Weighted aggregate score across all completed parts of a rich-content-quiz.
 * Pure helper shared by `StudentSubmissionService.submitPart` (classroom flow)
 * and `TaskDemoService.submitPart` (task-demo flow) so the weighting rule is
 * one source of truth.
 *
 * Dimensions are namespaced by part id (`${partId}_${rubricKey}`) so the
 * caller can distinguish partA's dimensions from partB's in the aggregate.
 */

import type { GradeResult, RichContentPart } from '../../../schemas';

export function computeRcqAggregateScore(
  parts: RichContentPart[],
  partsProgress: Record<string, { score?: GradeResult } | undefined>,
): GradeResult {
  let totalWeight = 0;
  let weightedSum = 0;
  const byDimension: Record<string, number | boolean> = {};

  for (const part of parts) {
    const pp = partsProgress[part.id];
    if (!pp?.score) continue;

    const partWeight = part.rubric.reduce((sum, r) => sum + r.weight, 0);
    totalWeight += partWeight;
    weightedSum += (pp.score.total / 100) * partWeight;

    for (const [key, val] of Object.entries(pp.score.byDimension || {})) {
      byDimension[`${part.id}_${key}`] = val as number | boolean;
    }
  }

  return {
    total: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0,
    byDimension,
  };
}
