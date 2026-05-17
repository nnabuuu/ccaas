/**
 * Zod ↔ AJV parity tests.
 * For each exercise type, run identical data through both:
 *   - validateAnswerKey() (Zod — trusted baseline)
 *   - service.validate()  (AJV + refinements — new)
 * and verify they agree.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { ExerciseTypeDef } from '../entities/exercise-type-def.entity';
import { ExerciseTypeRegistryService } from './exercise-type-registry.service';
import { validateAnswerKey } from '../schemas/answer-key.schema';

const seedPath = path.resolve(process.cwd(), 'data/seed/exercise-type-defs.json');
const seedData: ExerciseTypeDef[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

function mockRepo() {
  const store = [...seedData];
  return {
    find: jest.fn((opts?: { order?: Record<string, string> }) => {
      const results = [...store];
      if (opts?.order?.sortOrder === 'ASC') {
        results.sort((a, b) => a.sortOrder - b.sortOrder);
      }
      return Promise.resolve(results);
    }),
    save: jest.fn((entities: ExerciseTypeDef[]) => {
      return Promise.resolve(entities);
    }),
  };
}

let service: ExerciseTypeRegistryService;

beforeAll(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ExerciseTypeRegistryService,
      { provide: getRepositoryToken(ExerciseTypeDef), useValue: mockRepo() },
    ],
  }).compile();
  service = module.get(ExerciseTypeRegistryService);
  await service.onModuleInit();
});

function expectBothAgree(data: unknown) {
  const zod = validateAnswerKey(data);
  const ajv = service.validate(data);
  expect(ajv.valid).toBe(zod.valid);
}

describe('Zod ↔ AJV parity', () => {
  describe('quiz', () => {
    const valid = {
      type: 'quiz',
      answers: [
        { questionIdx: 0, questionText: 'Q1?', options: ['A', 'B', 'C'], correct: 1 },
        { questionIdx: 1, questionText: 'Q2?', options: ['X', 'Y'], correct: 0 },
      ],
    };

    it('valid: both pass', () => expectBothAgree(valid));

    it('invalid (correct >= options.length): both fail', () => {
      expectBothAgree({
        type: 'quiz',
        answers: [{ questionIdx: 0, questionText: 'Q?', options: ['A', 'B'], correct: 3 }],
      });
    });

    it('invalid (empty answers): both fail', () => {
      expectBothAgree({ type: 'quiz', answers: [] });
    });
  });

  describe('match', () => {
    const valid = {
      type: 'match',
      options: ['opt1', 'opt2', 'opt3'],
      answers: [
        { pairIdx: 0, left: 'left1', correct: 'opt1' },
        { pairIdx: 1, left: 'left2', correct: 'opt2' },
      ],
    };

    it('valid (root options): both pass', () => expectBothAgree(valid));

    it('invalid (no options anywhere): both fail', () => {
      expectBothAgree({
        type: 'match',
        answers: [{ pairIdx: 0, left: 'L', correct: 'R' }],
      });
    });
  });

  describe('matrix', () => {
    const valid = {
      type: 'matrix',
      answers: [
        { rowIdx: 0, place: 'Egypt', practice: 'painting', reason: 'beauty', isDemo: true },
        { rowIdx: 1, place: 'Europe', practice: 'pale skin', reason: 'wealth' },
      ],
    };

    it('valid (demo + non-demo): both pass', () => expectBothAgree(valid));

    it('invalid (non-demo without practice): both fail', () => {
      expectBothAgree({
        type: 'matrix',
        answers: [{ rowIdx: 0, place: 'X', reason: 'Y' }],
      });
    });
  });

  describe('stance', () => {
    const valid = {
      type: 'stance',
      validPositions: ['I agree', 'I disagree'],
      minEvidence: 2,
      stanceOpts: ['I agree', 'I partly agree', 'I disagree'],
      evidence: ['fact1', 'fact2'],
    };

    it('valid: both pass', () => expectBothAgree(valid));

    it('invalid (minEvidence: 0): both fail', () => {
      expectBothAgree({ ...valid, minEvidence: 0 });
    });
  });

  describe('order', () => {
    const valid = {
      type: 'order',
      items: ['A', 'B', 'C', 'D'],
      correctOrder: [1, 3, 0, 2],
    };

    it('valid: both pass', () => expectBothAgree(valid));

    it('invalid (mismatched lengths): both fail', () => {
      expectBothAgree({ type: 'order', items: ['A', 'B'], correctOrder: [1, 0, 2] });
    });

    it('invalid (duplicate indices): both fail', () => {
      expectBothAgree({ type: 'order', items: ['A', 'B', 'C'], correctOrder: [0, 0, 1] });
    });
  });

  describe('select-evidence', () => {
    const valid = {
      type: 'select-evidence',
      functionOptions: ['Phenomenon', 'History', 'Culture', 'Conclusion'],
      sections: [
        { id: 'p12', label: '¶1-2', range: [1, 2], correctFunction: 'Phenomenon' },
        { id: 'p34', label: '¶3-4', range: [3, 4], correctFunction: 'History' },
      ],
      paragraphTokens: {
        '1': [{ t: 'text' }],
        '2': [{ t: 'text' }],
        '3': [{ t: 'text' }],
        '4': [{ t: 'text' }],
      },
    };

    it('valid: both pass', () => expectBothAgree(valid));

    it('invalid (correctFunction not in functionOptions): both fail', () => {
      expectBothAgree({
        ...valid,
        sections: [{ id: 's1', label: 'L', range: [1], correctFunction: 'NotAnOption' }],
      });
    });
  });

  describe('map', () => {
    const valid = {
      type: 'map',
      prompt: 'Place items on the map',
      axes: {
        x: { neg: 'Bad', pos: 'Good', label: 'Quality' },
        y: { neg: 'Old', pos: 'New', label: 'Time' },
      },
      items: [{ id: 'i1', label: 'Item 1' }],
    };

    it('valid: both pass', () => expectBothAgree(valid));

    it('invalid (missing prompt): both fail', () => {
      const { prompt: _, ...noPrompt } = valid;
      expectBothAgree(noPrompt);
    });
  });

  describe('image-upload', () => {
    const valid = {
      type: 'image-upload',
      prompt: 'Upload your work',
      rubric: [{ id: 'r1', label: 'Accuracy', weight: 1, criteria: 'Is it correct?' }],
    };

    it('valid: both pass', () => expectBothAgree(valid));

    it('invalid (empty rubric): both fail', () => {
      expectBothAgree({ type: 'image-upload', prompt: 'Upload', rubric: [] });
    });
  });

  describe('fill-blank', () => {
    const valid = {
      type: 'fill-blank',
      sentences: [
        {
          id: 's1',
          template: 'The {{blank1}} is blue',
          blanks: { blank1: { accepts: ['sky'] } },
        },
      ],
    };

    it('valid: both pass', () => expectBothAgree(valid));

    it('invalid (empty sentences): both fail', () => {
      expectBothAgree({ type: 'fill-blank', sentences: [] });
    });
  });
});
