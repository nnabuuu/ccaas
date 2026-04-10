import type { HarnessRun, ExitConditions } from './interfaces.js';

export function shouldExit(
  run: HarnessRun,
  conditions: ExitConditions,
): { exit: boolean; reason: string } {
  const iterationCount = run.iterations.length;

  // Check maxIterations
  if (iterationCount >= conditions.maxIterations) {
    return { exit: true, reason: `Reached max iterations (${conditions.maxIterations})` };
  }

  // Need at least one completed iteration to check score-based conditions
  const completedIterations = run.iterations.filter((i) => i.status === 'completed' && i.score != null);
  if (completedIterations.length === 0) {
    return { exit: false, reason: '' };
  }

  const latestScore = completedIterations[completedIterations.length - 1].score!;

  // Check scoreThreshold
  if (conditions.scoreThreshold != null && latestScore >= conditions.scoreThreshold) {
    return { exit: true, reason: `Score ${latestScore} reached threshold ${conditions.scoreThreshold}` };
  }

  // Check minImprovement (need 2 consecutive rounds of low improvement = 3 scored iterations)
  if (conditions.minImprovement != null && completedIterations.length >= 3) {
    const curr = completedIterations[completedIterations.length - 1].score!;
    const prev = completedIterations[completedIterations.length - 2].score!;
    const prevPrev = completedIterations[completedIterations.length - 3].score!;
    const delta1 = prev - prevPrev;
    const delta2 = curr - prev;
    if (delta1 < conditions.minImprovement && delta2 < conditions.minImprovement) {
      return {
        exit: true,
        reason: `2 consecutive improvements (${delta1}, ${delta2}) below minimum ${conditions.minImprovement}`,
      };
    }
  }

  return { exit: false, reason: '' };
}
