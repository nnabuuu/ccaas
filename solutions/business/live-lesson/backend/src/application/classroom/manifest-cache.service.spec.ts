import { ManifestCacheService } from '../classroom/manifest-cache.service';
import { Repository } from 'typeorm';
import { Lesson } from '../../entities/lesson.entity';

function makeLessonRepo(overrides: Partial<Repository<Lesson>> = {}): Repository<Lesson> {
  return { findOne: jest.fn(), ...overrides } as any;
}

function makeLesson(id: string, manifestJson: string): Lesson {
  return { id, manifestJson } as Lesson;
}

describe('ManifestCacheService', () => {
  let svc: ManifestCacheService;
  let repo: Repository<Lesson>;

  beforeEach(() => {
    svc = new ManifestCacheService();
    jest.restoreAllMocks();
  });

  it('getManifest returns parsed manifest from DB', async () => {
    const manifest = { id: 'lesson-1', title: 'Test' };
    repo = makeLessonRepo({
      findOne: jest.fn().mockResolvedValue(makeLesson('lesson-1', JSON.stringify(manifest))),
    });

    const result = await svc.getManifest('lesson-1', repo);
    expect(result).toEqual(manifest);
  });

  it('getManifest returns null for missing lesson', async () => {
    repo = makeLessonRepo({
      findOne: jest.fn().mockResolvedValue(null),
    });

    const result = await svc.getManifest('nonexistent', repo);
    expect(result).toBeNull();
  });

  it('getManifest returns null for corrupt JSON', async () => {
    repo = makeLessonRepo({
      findOne: jest.fn().mockResolvedValue(makeLesson('bad', '{invalid')),
    });

    const result = await svc.getManifest('bad', repo);
    expect(result).toBeNull();
  });

  it('getManifest serves from cache on second call (TTL)', async () => {
    const manifest = { id: 'cached', title: 'Cached' };
    const findOne = jest.fn().mockResolvedValue(makeLesson('cached', JSON.stringify(manifest)));
    repo = makeLessonRepo({ findOne });

    await svc.getManifest('cached', repo);
    await svc.getManifest('cached', repo);

    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('getManifest refetches after TTL expires', async () => {
    jest.useFakeTimers();
    try {
      const manifest = { id: 'ttl', title: 'TTL' };
      const findOne = jest.fn().mockResolvedValue(makeLesson('ttl', JSON.stringify(manifest)));
      repo = makeLessonRepo({ findOne });

      await svc.getManifest('ttl', repo);
      expect(findOne).toHaveBeenCalledTimes(1);

      // Advance past 60s TTL
      jest.advanceTimersByTime(61_000);

      await svc.getManifest('ttl', repo);
      expect(findOne).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('invalidate() forces refetch', async () => {
    const manifest = { id: 'inv', title: 'Invalidate' };
    const findOne = jest.fn().mockResolvedValue(makeLesson('inv', JSON.stringify(manifest)));
    repo = makeLessonRepo({ findOne });

    await svc.getManifest('inv', repo);
    svc.invalidate('inv');
    await svc.getManifest('inv', repo);

    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('max size eviction removes oldest entry', async () => {
    const MAX_SIZE = 50;
    const findOne = jest.fn().mockImplementation(({ where: { id } }) =>
      Promise.resolve(makeLesson(id, JSON.stringify({ id }))),
    );
    repo = makeLessonRepo({ findOne });

    // Fill cache to MAX_SIZE
    for (let i = 0; i < MAX_SIZE; i++) {
      await svc.getManifest(`lesson-${i}`, repo);
    }
    expect(findOne).toHaveBeenCalledTimes(MAX_SIZE);

    // 'lesson-1' is cached — no DB call
    findOne.mockClear();
    await svc.getManifest('lesson-1', repo);
    expect(findOne).toHaveBeenCalledTimes(0);

    // Add one more — should evict 'lesson-0' (oldest)
    await svc.getManifest('lesson-new', repo);
    expect(findOne).toHaveBeenCalledTimes(1);

    // 'lesson-0' was evicted → must refetch from DB
    findOne.mockClear();
    await svc.getManifest('lesson-0', repo);
    expect(findOne).toHaveBeenCalledTimes(1);
  });
});
