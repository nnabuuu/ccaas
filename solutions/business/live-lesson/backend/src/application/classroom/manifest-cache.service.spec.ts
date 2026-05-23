import { ManifestCacheService } from '../classroom/manifest-cache.service';
import type { LessonRepoPort } from '../../domain/ports/lesson-repo.port';
import type { LessonRecord } from '../../domain/types/lesson';

function makeLessonRepo(findById: jest.Mock): LessonRepoPort {
  return {
    findById,
    findByIds: jest.fn(),
    findAllSeedFields: jest.fn(),
    findAllForList: jest.fn(),
    insert: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
}

function makeLesson(id: string, manifestJson: string): LessonRecord {
  return { id, manifestJson } as LessonRecord;
}

describe('ManifestCacheService', () => {
  let svc: ManifestCacheService;
  let repo: LessonRepoPort;

  beforeEach(() => {
    svc = new ManifestCacheService();
    jest.restoreAllMocks();
  });

  it('getManifest returns parsed manifest from DB', async () => {
    const manifest = { id: 'lesson-1', title: 'Test' };
    repo = makeLessonRepo(jest.fn().mockResolvedValue(makeLesson('lesson-1', JSON.stringify(manifest))));

    const result = await svc.getManifest('lesson-1', repo);
    expect(result).toEqual(manifest);
  });

  it('getManifest returns null for missing lesson', async () => {
    repo = makeLessonRepo(jest.fn().mockResolvedValue(null));

    const result = await svc.getManifest('nonexistent', repo);
    expect(result).toBeNull();
  });

  it('getManifest returns null for corrupt JSON', async () => {
    repo = makeLessonRepo(jest.fn().mockResolvedValue(makeLesson('bad', '{invalid')));

    const result = await svc.getManifest('bad', repo);
    expect(result).toBeNull();
  });

  it('getManifest serves from cache on second call (TTL)', async () => {
    const manifest = { id: 'cached', title: 'Cached' };
    const findById = jest.fn().mockResolvedValue(makeLesson('cached', JSON.stringify(manifest)));
    repo = makeLessonRepo(findById);

    await svc.getManifest('cached', repo);
    await svc.getManifest('cached', repo);

    expect(findById).toHaveBeenCalledTimes(1);
  });

  it('getManifest refetches after TTL expires', async () => {
    jest.useFakeTimers();
    try {
      const manifest = { id: 'ttl', title: 'TTL' };
      const findById = jest.fn().mockResolvedValue(makeLesson('ttl', JSON.stringify(manifest)));
      repo = makeLessonRepo(findById);

      await svc.getManifest('ttl', repo);
      expect(findById).toHaveBeenCalledTimes(1);

      // Advance past 60s TTL
      jest.advanceTimersByTime(61_000);

      await svc.getManifest('ttl', repo);
      expect(findById).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('invalidate() forces refetch', async () => {
    const manifest = { id: 'inv', title: 'Invalidate' };
    const findById = jest.fn().mockResolvedValue(makeLesson('inv', JSON.stringify(manifest)));
    repo = makeLessonRepo(findById);

    await svc.getManifest('inv', repo);
    svc.invalidate('inv');
    await svc.getManifest('inv', repo);

    expect(findById).toHaveBeenCalledTimes(2);
  });

  it('max size eviction removes oldest entry', async () => {
    const MAX_SIZE = 50;
    const findById = jest.fn().mockImplementation((id: string) =>
      Promise.resolve(makeLesson(id, JSON.stringify({ id }))),
    );
    repo = makeLessonRepo(findById);

    // Fill cache to MAX_SIZE
    for (let i = 0; i < MAX_SIZE; i++) {
      await svc.getManifest(`lesson-${i}`, repo);
    }
    expect(findById).toHaveBeenCalledTimes(MAX_SIZE);

    // 'lesson-1' is cached — no DB call
    findById.mockClear();
    await svc.getManifest('lesson-1', repo);
    expect(findById).toHaveBeenCalledTimes(0);

    // Add one more — should evict 'lesson-0' (oldest)
    await svc.getManifest('lesson-new', repo);
    expect(findById).toHaveBeenCalledTimes(1);

    // 'lesson-0' was evicted → must refetch from DB
    findById.mockClear();
    await svc.getManifest('lesson-0', repo);
    expect(findById).toHaveBeenCalledTimes(1);
  });
});
