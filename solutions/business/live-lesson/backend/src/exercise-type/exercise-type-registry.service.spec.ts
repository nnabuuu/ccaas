import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExerciseTypeDef } from '../entities/exercise-type-def.entity';
import { ExerciseTypeRegistryService } from './exercise-type-registry.service';
import * as path from 'path';

// jest.mock must come before imports that use fs — mock with passthrough defaults
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn((...args: unknown[]) => actual.existsSync(...args)),
    readFileSync: jest.fn((...args: unknown[]) => actual.readFileSync(...args)),
  };
});
import * as fs from 'fs';
const mockedFs = fs as jest.Mocked<typeof fs>;

// Load real seed data (calls through to actual fs above)
const seedPath = path.resolve(process.cwd(), 'data/seed/exercise-type-defs.json');
const seedData: ExerciseTypeDef[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

function mockRepo(initial: ExerciseTypeDef[] = []) {
  const store = [...initial];
  return {
    find: jest.fn((opts?: { order?: Record<string, string> }) => {
      const results = [...store];
      if (opts?.order?.sortOrder === 'ASC') {
        results.sort((a, b) => a.sortOrder - b.sortOrder);
      }
      return Promise.resolve(results);
    }),
    save: jest.fn((entities: ExerciseTypeDef | ExerciseTypeDef[]) => {
      const arr = Array.isArray(entities) ? entities : [entities];
      for (const e of arr) {
        if (!store.find((s) => s.type === e.type)) store.push(e);
      }
      return Promise.resolve(arr);
    }),
  };
}

async function buildService(repo: ReturnType<typeof mockRepo>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ExerciseTypeRegistryService,
      { provide: getRepositoryToken(ExerciseTypeDef), useValue: repo },
    ],
  }).compile();
  const service = module.get(ExerciseTypeRegistryService);
  await service.onModuleInit();
  return service;
}

describe('ExerciseTypeRegistryService', () => {
  afterEach(() => {
    // Restore passthrough behavior after each test
    mockedFs.existsSync.mockImplementation(
      jest.requireActual('fs').existsSync,
    );
    mockedFs.readFileSync.mockImplementation(
      jest.requireActual('fs').readFileSync,
    );
  });

  describe('onModuleInit / seeding', () => {
    it('seeds all types when DB is empty', async () => {
      const repo = mockRepo();
      await buildService(repo);

      expect(repo.save).toHaveBeenCalledTimes(1);
      const saved = repo.save.mock.calls[0][0] as ExerciseTypeDef[];
      expect(saved.length).toBe(seedData.length);
    });

    it('skips already-existing types', async () => {
      const existing = [seedData[0], seedData[1]]; // quiz, match
      const repo = mockRepo(existing);
      await buildService(repo);

      const saved = repo.save.mock.calls[0][0] as ExerciseTypeDef[];
      expect(saved.every((d) => d.type !== 'quiz' && d.type !== 'match')).toBe(true);
      expect(saved.length).toBe(seedData.length - 2);
    });

    it('handles missing seed file gracefully', async () => {
      mockedFs.existsSync.mockReturnValueOnce(false as any);
      const repo = mockRepo();
      const service = await buildService(repo);

      expect(repo.save).not.toHaveBeenCalled();
      expect(service.getAllDefs()).toEqual([]);
    });

    it('handles malformed JSON seed file', async () => {
      mockedFs.readFileSync.mockReturnValueOnce('not json{{{' as any);
      const repo = mockRepo();
      const service = await buildService(repo);

      expect(repo.save).not.toHaveBeenCalled();
      expect(service.getAllDefs()).toEqual([]);
    });
  });

  describe('validate() — schema layer', () => {
    let service: ExerciseTypeRegistryService;

    beforeAll(async () => {
      service = await buildService(mockRepo(seedData));
    });

    it('rejects null input', () => {
      const r = service.validate(null);
      expect(r.valid).toBe(false);
      expect(r.errors[0].message).toMatch(/must be an object/);
    });

    it('rejects undefined input', () => {
      const r = service.validate(undefined);
      expect(r.valid).toBe(false);
    });

    it('rejects non-object input', () => {
      const r = service.validate('string');
      expect(r.valid).toBe(false);
    });

    it('rejects missing "type" field', () => {
      const r = service.validate({ answers: [] });
      expect(r.valid).toBe(false);
      expect(r.errors[0].message).toMatch(/type/);
    });

    it('rejects unknown type', () => {
      const r = service.validate({ type: 'bogus' });
      expect(r.valid).toBe(false);
      expect(r.errors[0].message).toMatch(/unknown/);
    });

    it('passes valid quiz data', () => {
      const r = service.validate({
        type: 'quiz',
        answers: [{ questionIdx: 0, questionText: 'Q?', options: ['A', 'B'], correct: 0 }],
      });
      expect(r.valid).toBe(true);
      expect(r.errors).toHaveLength(0);
    });

    it('fails quiz with missing required field (questionText)', () => {
      const r = service.validate({
        type: 'quiz',
        answers: [{ questionIdx: 0, options: ['A', 'B'], correct: 0 }],
      });
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.type === 'schema')).toBe(true);
    });

    it('passes valid match data', () => {
      const r = service.validate({
        type: 'match',
        options: ['opt1', 'opt2'],
        answers: [{ pairIdx: 0, left: 'L', correct: 'opt1' }],
      });
      expect(r.valid).toBe(true);
    });

    it('passes valid order data', () => {
      const r = service.validate({
        type: 'order',
        items: ['A', 'B', 'C'],
        correctOrder: [2, 0, 1],
      });
      expect(r.valid).toBe(true);
    });

    it('fails order with non-integer correctOrder values', () => {
      const r = service.validate({
        type: 'order',
        items: ['A', 'B'],
        correctOrder: [1.5, 0.5],
      });
      expect(r.valid).toBe(false);
    });
  });

  describe('validate() — refinement layer', () => {
    let service: ExerciseTypeRegistryService;

    beforeAll(async () => {
      service = await buildService(mockRepo(seedData));
    });

    it('quiz: passes when correct < options.length', () => {
      const r = service.validate({
        type: 'quiz',
        answers: [{ questionIdx: 0, questionText: 'Q?', options: ['A', 'B', 'C'], correct: 1 }],
      });
      expect(r.valid).toBe(true);
    });

    it('quiz: fails when correct >= options.length', () => {
      const r = service.validate({
        type: 'quiz',
        answers: [{ questionIdx: 0, questionText: 'Q?', options: ['A', 'B'], correct: 2 }],
      });
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.type === 'refinement')).toBe(true);
    });

    it('match: passes with item-level options', () => {
      const r = service.validate({
        type: 'match',
        answers: [{ pairIdx: 0, left: 'L', correct: 'R', options: ['R', 'S'] }],
      });
      expect(r.valid).toBe(true);
    });

    it('match: passes with root-level options', () => {
      const r = service.validate({
        type: 'match',
        options: ['R', 'S'],
        answers: [{ pairIdx: 0, left: 'L', correct: 'R' }],
      });
      expect(r.valid).toBe(true);
    });

    it('match: fails when neither has options', () => {
      const r = service.validate({
        type: 'match',
        answers: [{ pairIdx: 0, left: 'L', correct: 'R' }],
      });
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.type === 'refinement')).toBe(true);
    });

    it('matrix: passes demo row without practice/reason', () => {
      const r = service.validate({
        type: 'matrix',
        answers: [{ rowIdx: 0, place: 'X', isDemo: true }],
      });
      expect(r.valid).toBe(true);
    });

    it('matrix: fails non-demo row without practice', () => {
      const r = service.validate({
        type: 'matrix',
        answers: [{ rowIdx: 0, place: 'X', reason: 'Y' }],
      });
      expect(r.valid).toBe(false);
    });

    it('order: fails mismatched lengths', () => {
      const r = service.validate({
        type: 'order',
        items: ['A', 'B'],
        correctOrder: [0, 1, 2],
      });
      expect(r.valid).toBe(false);
    });

    it('order: fails duplicate indices', () => {
      const r = service.validate({
        type: 'order',
        items: ['A', 'B', 'C'],
        correctOrder: [0, 0, 1],
      });
      expect(r.valid).toBe(false);
    });

    it('select-evidence: fails correctFunction not in set', () => {
      const r = service.validate({
        type: 'select-evidence',
        functionOptions: ['Phenomenon', 'History'],
        sections: [{ id: 's1', label: 'L', range: [1], correctFunction: 'NotAnOption' }],
      });
      expect(r.valid).toBe(false);
    });
  });

  describe('getAllDefs()', () => {
    it('returns all loaded defs sorted by sortOrder', async () => {
      const service = await buildService(mockRepo(seedData));
      const defs = service.getAllDefs();
      expect(defs.length).toBe(seedData.length);
      for (let i = 1; i < defs.length; i++) {
        expect(defs[i].sortOrder).toBeGreaterThanOrEqual(defs[i - 1].sortOrder);
      }
    });

    it('returns empty array when DB is empty', async () => {
      mockedFs.existsSync.mockReturnValueOnce(false as any);
      const service = await buildService(mockRepo());
      expect(service.getAllDefs()).toEqual([]);
    });
  });

  describe('getDefaultValue()', () => {
    it('returns parsed JSON for known type', async () => {
      const service = await buildService(mockRepo(seedData));
      const val = service.getDefaultValue('quiz');
      expect(val).toEqual({ type: 'quiz', answers: [] });
    });

    it('returns null for unknown type', async () => {
      const service = await buildService(mockRepo(seedData));
      expect(service.getDefaultValue('nonexistent')).toBeNull();
    });
  });
});
