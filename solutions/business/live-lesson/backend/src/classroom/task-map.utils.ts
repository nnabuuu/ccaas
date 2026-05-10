import type { TaskMap } from '../schemas';
import { Repository } from 'typeorm';
import { Lesson } from '../entities/lesson.entity';

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
const taskMapCache = new Map<string, TaskMap>();

/** Get TaskMap for a lesson, with caching. */
export async function getCachedTaskMap(
  lessonId: string,
  lessonRepo: Repository<Lesson>,
): Promise<TaskMap> {
  const cached = taskMapCache.get(lessonId);
  if (cached) return cached;

  const lesson = await lessonRepo.findOne({ where: { id: lessonId } });
  let manifest: any = null;
  if (lesson) {
    try { manifest = JSON.parse(lesson.manifestJson); } catch {}
  }
  const taskMap = buildTaskMap(manifest);
  if (taskMapCache.size >= MAX_CACHE_SIZE) {
    const firstKey = taskMapCache.keys().next().value;
    if (firstKey !== undefined) taskMapCache.delete(firstKey);
  }
  taskMapCache.set(lessonId, taskMap);
  return taskMap;
}
