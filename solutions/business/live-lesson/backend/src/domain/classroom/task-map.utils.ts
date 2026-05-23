/**
 * TaskMap — derived from a lesson manifest.
 *
 * Pure helper. The caching/Repository wrapper (`getCachedTaskMap`) lives in
 * `application/classroom/task-map-cache.ts` because it reaches into the
 * persistence layer.
 */
import type { TaskMap } from '../../schemas';

/** Build TaskMap from manifest. Fallback: steps with answerKey are tasks. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTaskMap(manifest: any): TaskMap {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readingSteps: any[] = manifest?.readingSteps || [];
  const taskDefs = readingSteps
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((s: any) => s.type === 'task' || (!s.type && s.answerKey))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => a.idx - b.idx);

  const stepToTask: Record<number, number> = {};
  const taskToStep: Record<number, number> = {};
  const taskSteps: number[] = [];
  const advanceOn: Record<number, 'submit' | 'confirm'> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taskDefs.forEach((def: any, i: number) => {
    const taskNum = i + 1;
    stepToTask[def.idx] = taskNum;
    taskToStep[taskNum] = def.idx;
    taskSteps.push(def.idx);
    advanceOn[def.idx] = def.advanceOn === 'submit' ? 'submit' : 'confirm';
  });

  return { stepToTask, taskToStep, taskSteps, maxTask: taskDefs.length, advanceOn };
}
