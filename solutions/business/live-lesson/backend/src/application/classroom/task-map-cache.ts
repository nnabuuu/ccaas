/**
 * Cached TaskMap loader.
 *
 * Lives in application/ (not domain/) because it reaches into the persistence
 * layer via TypeORM `Repository<Lesson>` to load the manifest. The pure
 * `buildTaskMap(manifest)` half stays in `domain/classroom/task-map.utils.ts`
 * and is what the actual TaskMap construction logic lives in.
 */
import type { Repository } from 'typeorm';
import type { Lesson } from '../../adapters/persistence/entities/lesson.entity';
import type { TaskMap } from '../../schemas';
import { buildTaskMap } from '../../domain/classroom/task-map.utils';

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
  let manifest: unknown = null;
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
