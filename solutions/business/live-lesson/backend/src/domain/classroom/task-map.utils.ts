import type { TaskMap } from '../../schemas';
import { Repository } from 'typeorm';
import { Lesson } from '../../adapters/persistence/entities/lesson.entity';

/** Build TaskMap from manifest. Fallback: steps with answerKey are tasks. */
export function buildTaskMap(manifest: any): TaskMap {
  const readingSteps: any[] = manifest?.readingSteps || [];
  const taskDefs = readingSteps
    .filter((s: any) => s.type === 'task' || (!s.type && s.answerKey))
    .sort((a: any, b: any) => a.idx - b.idx);

  const stepToTask: Record<number, number> = {};
  const taskToStep: Record<number, number> = {};
  const taskSteps: number[] = [];
  const advanceOn: Record<number, 'submit' | 'confirm'> = {};

  taskDefs.forEach((def: any, i: number) => {
    const taskNum = i + 1;
    stepToTask[def.idx] = taskNum;
    taskToStep[taskNum] = def.idx;
    taskSteps.push(def.idx);
    advanceOn[def.idx] = def.advanceOn === 'submit' ? 'submit' : 'confirm';
  });

  return { stepToTask, taskToStep, taskSteps, maxTask: taskDefs.length, advanceOn };
}

const MAX_CACHE_SIZE = 100;
const TTL_MS = 5 * 60_000;
const taskMapCache = new Map<string, { map: TaskMap; cachedAt: number }>();

/** Get TaskMap for a lesson, with caching and TTL. */
export async function getCachedTaskMap(
  lessonId: string,
  lessonRepo: Repository<Lesson>,
): Promise<TaskMap> {
  const cached = taskMapCache.get(lessonId);
  if (cached && Date.now() - cached.cachedAt < TTL_MS) return cached.map;

  const lesson = await lessonRepo.findOne({ where: { id: lessonId } });
  let manifest: any = null;
  if (lesson) {
    try { manifest = JSON.parse(lesson.manifestJson); } catch { /* caller handles null manifest */ }
  }
  const taskMap = buildTaskMap(manifest);
  if (taskMapCache.size >= MAX_CACHE_SIZE) {
    const firstKey = taskMapCache.keys().next().value;
    if (firstKey !== undefined) taskMapCache.delete(firstKey);
  }
  taskMapCache.set(lessonId, { map: taskMap, cachedAt: Date.now() });
  return taskMap;
}
