/**
 * LessonService unit tests.
 *
 * Covers:
 *   - findAll()         — repository column-projection
 *   - findManifest()    — id validation, not-found, sanitization, corruption fallback
 *   - seedLessons()     — onModuleInit path with the four sub-flows:
 *                         no data dir → warn + noop;
 *                         existing lesson with stale lessonType/description → update;
 *                         new lesson → seed + validate;
 *                         malformed manifest JSON → catch + log, don't crash.
 *
 * Filesystem is faked via vi-style spies on `fs.existsSync` / `readdirSync` /
 * `readFileSync` and the repository via an in-memory map.
 */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { Lesson } from '../../entities/lesson.entity';

// `fs.existsSync`/`readdirSync`/`readFileSync` aren't spyable in newer Node
// (they're non-configurable). Use jest.mock('fs') for the whole module so
// seedLessons() reads our fixtures instead of the real filesystem.
jest.mock('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as jest.Mocked<typeof import('fs')>;

type LessonRow = Pick<Lesson, 'id' | 'title' | 'subject' | 'gradeLevel' | 'description' | 'emoji' | 'lessonType' | 'teachingNotes' | 'manifestJson'>;

function makeRepoMock() {
  const store = new Map<string, LessonRow>();
  return {
    store,
    create: jest.fn((row: LessonRow) => row),
    save: jest.fn(async (row: LessonRow) => {
      store.set(row.id, row);
      return row;
    }),
    find: jest.fn(async (opts?: { select?: string[] }) => {
      const rows = [...store.values()];
      if (!opts?.select) return rows;
      return rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const k of opts.select!) out[k] = (r as Record<string, unknown>)[k];
        return out;
      });
    }),
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => store.get(where.id) ?? null),
  };
}

import { DiscoveryModule } from '@nestjs/core';
import { PLUGIN_PROVIDERS } from '../../classroom/exercise/plugins/test-utils';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';

async function buildService(repo: ReturnType<typeof makeRepoMock>): Promise<LessonService> {
  // LessonService now depends on ExerciseTypeRegistry (for sanitizeManifest).
  // Bootstrap the full plugin registry so the service can dispatch sanitize.
  const mockAi = {
    callLlm: () => Promise.reject(new Error('mock')),
    callVisionLlm: () => Promise.reject(new Error('mock')),
  } as unknown as AiPromptBuilder;
  const module = await Test.createTestingModule({
    imports: [DiscoveryModule],
    providers: [
      LessonService,
      { provide: getRepositoryToken(Lesson), useValue: repo },
      { provide: AiPromptBuilder, useValue: mockAi },
      ...PLUGIN_PROVIDERS,
    ],
  }).compile();
  await module.init();
  return module.get(LessonService);
}

const VALID_MANIFEST = {
  id: 'demo-lesson',
  title: 'Demo Lesson',
  subject: '语文',
  gradeLevel: 'G7',
  description: 'A demo lesson',
  lessonType: 'interactive',
  teachingNotes: 'For testing',
  readingSteps: [
    {
      idx: 1,
      type: 'task',
      strategy: 'quiz',
      label: 'Q1',
      duration: 2,
      answerKey: {
        type: 'quiz',
        answers: [
          { questionIdx: 0, correct: 0, questionText: 'Q?', options: ['A', 'B'] },
        ],
      },
    },
  ],
};

describe('LessonService.findAll', () => {
  it('returns the column-projected lesson list wrapped in { lessons }', async () => {
    const repo = makeRepoMock();
    repo.store.set('a', {
      id: 'a',
      title: 'A',
      subject: 's',
      gradeLevel: 'g',
      description: 'd',
      emoji: '📖',
      lessonType: 'reading',
      teachingNotes: 'tn',
      manifestJson: '{}',
    } as LessonRow);

    const svc = await buildService(repo);
    const result = await svc.findAll();
    expect(result).toEqual({
      lessons: [
        expect.objectContaining({ id: 'a', title: 'A', lessonType: 'reading' }),
      ],
    });
    // Verify the column projection — manifestJson + teachingNotes are NOT in the response
    expect(result.lessons[0]).not.toHaveProperty('manifestJson');
    expect(result.lessons[0]).not.toHaveProperty('teachingNotes');
  });

  it('returns an empty list when there are no lessons', async () => {
    const repo = makeRepoMock();
    const svc = await buildService(repo);
    await expect(svc.findAll()).resolves.toEqual({ lessons: [] });
  });
});

describe('LessonService.findManifest', () => {
  it('throws NotFoundException for invalid id characters', async () => {
    const repo = makeRepoMock();
    const svc = await buildService(repo);
    await expect(svc.findManifest('../etc/passwd')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.findManifest("' OR 1=1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when the lesson is missing from the repo', async () => {
    const repo = makeRepoMock();
    const svc = await buildService(repo);
    await expect(svc.findManifest('nope')).rejects.toThrow(/Lesson nope not found/);
  });

  it('returns the sanitized manifest for a valid lesson', async () => {
    const repo = makeRepoMock();
    repo.store.set('demo-lesson', {
      id: 'demo-lesson',
      title: 'Demo',
      subject: '',
      gradeLevel: '',
      description: '',
      emoji: '📖',
      lessonType: 'interactive',
      teachingNotes: '',
      manifestJson: JSON.stringify(VALID_MANIFEST),
    } as LessonRow);

    const svc = await buildService(repo);
    const manifest = (await svc.findManifest('demo-lesson')) as Record<string, unknown>;
    expect(manifest.id).toBe('demo-lesson');
    const steps = manifest.readingSteps as Array<Record<string, unknown>>;
    expect(steps).toHaveLength(1);
    // sanitizeManifest replaces the answer-bearing key with a sanitized
    // ExerciseSpec: the `correct` index is stripped but `questions[]` survive.
    const ak = steps[0].answerKey as Record<string, unknown>;
    expect(ak.type).toBe('quiz');
    expect((ak.questions as Array<Record<string, unknown>>)[0]).toEqual(
      expect.objectContaining({ text: 'Q?', options: ['A', 'B'] }),
    );
    expect((ak.questions as Array<Record<string, unknown>>)[0]).not.toHaveProperty('correct');
  });

  it('throws InternalServerErrorException when manifestJson is corrupted', async () => {
    const repo = makeRepoMock();
    repo.store.set('broken', {
      id: 'broken',
      title: 'X',
      subject: '',
      gradeLevel: '',
      description: '',
      emoji: '📖',
      lessonType: 'interactive',
      teachingNotes: '',
      manifestJson: 'not json{{',
    } as LessonRow);
    const svc = await buildService(repo);
    await expect(svc.findManifest('broken')).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});

describe('LessonService.onModuleInit / seedLessons', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('no-ops when the data directory is missing', async () => {
    fs.existsSync.mockReturnValue(false);
    const repo = makeRepoMock();
    const svc = await buildService(repo);
    await svc.onModuleInit();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('seeds a new lesson from a valid manifest.json', async () => {
    const repo = makeRepoMock();
    fs.existsSync.mockImplementation((p) => {
      const s = String(p);
      return s.endsWith('lessons') || s.endsWith('manifest.json');
    });
    fs.readdirSync.mockReturnValue([
      { name: 'demo-lesson', isDirectory: () => true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    fs.readFileSync.mockReturnValue(JSON.stringify(VALID_MANIFEST));
    const svc = await buildService(repo);

    await svc.onModuleInit();
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.store.get('demo-lesson')).toBeTruthy();
    expect(repo.store.get('demo-lesson')?.title).toBe('Demo Lesson');
    expect(repo.store.get('demo-lesson')?.lessonType).toBe('interactive');
  });

  it('backfills lessonType + description on an existing lesson when stale', async () => {
    const repo = makeRepoMock();
    repo.store.set('demo-lesson', {
      id: 'demo-lesson',
      title: 'Demo',
      subject: '',
      gradeLevel: '',
      description: '',
      emoji: '📖',
      lessonType: 'reading',
      teachingNotes: '',
      manifestJson: 'old',
    } as LessonRow);
    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue([
      { name: 'demo-lesson', isDirectory: () => true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    fs.readFileSync.mockReturnValue(JSON.stringify(VALID_MANIFEST));
    const svc = await buildService(repo);

    await svc.onModuleInit();
    expect(repo.save).toHaveBeenCalledTimes(1);
    const updated = repo.store.get('demo-lesson')!;
    expect(updated.lessonType).toBe('interactive');
    expect(updated.description).toBe('A demo lesson');
  });

  it('does not save when an existing lesson is already fresh', async () => {
    const repo = makeRepoMock();
    repo.store.set('demo-lesson', {
      id: 'demo-lesson',
      title: 'Demo',
      subject: '',
      gradeLevel: '',
      description: 'A demo lesson',
      emoji: '📖',
      lessonType: 'interactive',
      teachingNotes: '',
      manifestJson: 'old',
    } as LessonRow);
    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue([
      { name: 'demo-lesson', isDirectory: () => true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    fs.readFileSync.mockReturnValue(JSON.stringify(VALID_MANIFEST));
    const svc = await buildService(repo);

    await svc.onModuleInit();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('logs but does not throw on malformed JSON', async () => {
    const repo = makeRepoMock();
    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue([
      { name: 'bad', isDirectory: () => true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    fs.readFileSync.mockReturnValue('not json {');
    const svc = await buildService(repo);

    await expect(svc.onModuleInit()).resolves.not.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('skips directories without a manifest.json', async () => {
    const repo = makeRepoMock();
    fs.existsSync.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith('lessons')) return true;
      return false;
    });
    fs.readdirSync.mockReturnValue([
      { name: 'empty-dir', isDirectory: () => true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const svc = await buildService(repo);
    await svc.onModuleInit();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('logs validation warnings but still seeds the lesson when manifest has soft issues', async () => {
    const repo = makeRepoMock();
    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue([
      { name: 'soft-issue', isDirectory: () => true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    const dodgy = {
      ...VALID_MANIFEST,
      id: 'soft-issue',
      readingSteps: [
        { idx: 1, type: 'task', strategy: 'quiz', label: 'Q', duration: 2, answerKey: { type: 'unknown-type' } },
      ],
    };
    fs.readFileSync.mockReturnValue(JSON.stringify(dodgy));
    const svc = await buildService(repo);
    await svc.onModuleInit();
    expect(repo.store.get('soft-issue')).toBeTruthy();
  });
});
