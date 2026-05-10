import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExerciseService } from './exercise.service';
import { GradingService } from './grading.service';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { ManifestCacheService } from '../manifest-cache.service';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { ClassroomSnapshot } from '../../entities/classroom-snapshot.entity';
import { Lesson } from '../../entities/lesson.entity';

const QUIZ_MANIFEST = {
  id: 'ex-quiz',
  title: 'Quiz Lesson',
  readingSteps: [{
    idx: 1, label: 'Quiz Step', strategy: 'quiz',
    answerKey: {
      type: 'quiz',
      answers: [
        { questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'], hint: 'Think again', walkthrough: 'Answer is B' },
        { questionIdx: 1, correct: 0, questionText: 'Q2', options: ['X', 'Y'] },
      ],
    },
  }],
};

const MATCH_MANIFEST = {
  id: 'ex-match',
  title: 'Match Lesson',
  readingSteps: [{
    idx: 1, label: 'Match Step', strategy: 'match',
    answerKey: {
      type: 'match',
      options: ['skimming', 'scanning'],
      answers: [
        { pairIdx: 0, left: 'Skim', correct: 'skimming' },
        { pairIdx: 1, left: 'Scan', correct: 'scanning' },
      ],
    },
  }],
};

const ORDER_MANIFEST = {
  id: 'ex-order',
  title: 'Order Lesson',
  readingSteps: [{
    idx: 1, label: 'Order Step', strategy: 'order',
    answerKey: {
      type: 'order',
      items: ['Introduction', 'Body', 'Conclusion'],
      correctOrder: [0, 1, 2],
    },
  }],
};

const SE_MANIFEST = {
  id: 'ex-se',
  title: 'Select Evidence Lesson',
  readingSteps: [{
    idx: 1, label: 'SE Step', strategy: 'select-evidence',
    answerKey: {
      type: 'select-evidence',
      functionOptions: ['cause-effect', 'compare-contrast'],
      sections: [
        { id: 'sec1', label: 'S1', range: [1], correctFunction: 'cause-effect', hint: 'Try cause', aiCorrect: 'Great!', aiPartial: 'Not quite' },
      ],
      paragraphTokens: {
        '1': [
          { t: 'The', kind: 'neutral' },
          { t: 'rain', kind: 'evidence', why: 'cause' },
        ],
      },
    },
  }],
};

const MAP_RANDOM_MANIFEST = {
  id: 'ex-map-random',
  title: 'Map Random Lesson',
  readingSteps: [{
    idx: 1, label: 'Map Step', strategy: 'map',
    answerKey: {
      type: 'map',
      prompt: 'Place on coordinate plane',
      axes: {
        x: { neg: 'Left', pos: 'Right', label: 'X-axis' },
        y: { neg: 'Bottom', pos: 'Top', label: 'Y-axis' },
      },
      items: [
        { id: 'a', label: 'A' }, { id: 'b', label: 'B' },
        { id: 'c', label: 'C' }, { id: 'd', label: 'D' },
        { id: 'e', label: 'E' },
      ],
      expected: { a: [0.5, 0.5], b: [-0.5, 0.5], c: [0.5, -0.5], d: [-0.5, -0.5], e: [0, 0] },
      practiceCount: 3,
      randomPractice: true,
    },
  }],
};

const NO_KEY_MANIFEST = {
  id: 'ex-nokey',
  title: 'No Key Lesson',
  readingSteps: [{ idx: 1, label: 'Reading', strategy: 'read' }],
};

describe('ExerciseService', () => {
  let module: TestingModule;
  let service: ExerciseService;
  let studentRepo: Repository<Student>;
  let lessonRepo: Repository<Lesson>;
  let sessionRepo: Repository<ClassroomSession>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion, ClassroomSnapshot],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, Submission, ClassroomSession, AiQuestion, ClassroomSnapshot]),
      ],
      providers: [
        ExerciseService,
        GradingService,
        ManifestCacheService,
        {
          provide: AiPromptBuilder,
          useValue: { callLlm: jest.fn().mockRejectedValue(new Error('not configured in test')) },
        },
      ],
    }).compile();

    service = module.get(ExerciseService);
    studentRepo = module.get(getRepositoryToken(Student));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));

    // Seed lessons
    for (const m of [QUIZ_MANIFEST, MATCH_MANIFEST, ORDER_MANIFEST, SE_MANIFEST, MAP_RANDOM_MANIFEST, NO_KEY_MANIFEST]) {
      await lessonRepo.save(lessonRepo.create({
        id: m.id, title: m.title, subject: 'English', gradeLevel: '7',
        manifestJson: JSON.stringify(m),
      }));
    }
  });

  afterAll(async () => {
    await module.close();
  });

  async function createSessionAndStudent(lessonId: string) {
    const session = await sessionRepo.save(sessionRepo.create({
      lessonId, code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: 'active', currentStep: 0,
    }));
    const student = await studentRepo.save(studentRepo.create({
      sessionId: session.id, lessonId: session.lessonId,
      name: `TestStudent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      currentTask: 1, currentPhase: 'practice',
    }));
    return { session, student };
  }

  // ── getExerciseSpec ──

  describe('getExerciseSpec', () => {
    it('returns sanitized quiz spec (no correct answer)', async () => {
      const { session } = await createSessionAndStudent('ex-quiz');
      const spec = await service.getExerciseSpec(session, 1);
      expect(spec.type).toBe('quiz');
      expect(spec.questions).toBeDefined();
      expect(spec.questions![0].options).toBeDefined();
      // correct field should be stripped
      expect((spec.questions![0] as any).correct).toBeUndefined();
    });

    it('returns sanitized match spec', async () => {
      const { session } = await createSessionAndStudent('ex-match');
      const spec = await service.getExerciseSpec(session, 1);
      expect(spec.type).toBe('match');
    });

    it('returns sanitized order spec', async () => {
      const { session } = await createSessionAndStudent('ex-order');
      const spec = await service.getExerciseSpec(session, 1);
      expect(spec.type).toBe('order');
    });

    it('returns sanitized select-evidence spec', async () => {
      const { session } = await createSessionAndStudent('ex-se');
      const spec = await service.getExerciseSpec(session, 1);
      expect(spec.type).toBe('select-evidence');
    });

    it('throws NotFoundException for missing lesson', async () => {
      const session = { id: 'fake', lessonId: 'nonexistent', code: 'AAAAAA', status: 'active' } as ClassroomSession;
      await expect(service.getExerciseSpec(session, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for step with no answerKey', async () => {
      const { session } = await createSessionAndStudent('ex-nokey');
      await expect(service.getExerciseSpec(session, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for nonexistent step', async () => {
      const { session } = await createSessionAndStudent('ex-quiz');
      await expect(service.getExerciseSpec(session, 99)).rejects.toThrow(NotFoundException);
    });

    it('returns practiceItemIds when randomPractice + studentId provided', async () => {
      const { session, student } = await createSessionAndStudent('ex-map-random');
      const spec = await service.getExerciseSpec(session, 1, student.id);
      expect(spec.type).toBe('map');
      expect(spec.practiceItemIds).toBeDefined();
      expect(spec.practiceItemIds).toHaveLength(3);
      // All IDs should be from the original item set
      const validIds = new Set(['a', 'b', 'c', 'd', 'e']);
      for (const id of spec.practiceItemIds!) {
        expect(validIds.has(id)).toBe(true);
      }
      // givenPlacements should contain the other 2 items
      expect(spec.givenPlacements).toBeDefined();
      expect(Object.keys(spec.givenPlacements!)).toHaveLength(2);
    });

    it('returns deterministic practiceItemIds for same student', async () => {
      const { session, student } = await createSessionAndStudent('ex-map-random');
      const spec1 = await service.getExerciseSpec(session, 1, student.id);
      const spec2 = await service.getExerciseSpec(session, 1, student.id);
      expect(spec1.practiceItemIds).toEqual(spec2.practiceItemIds);
    });

    it('returns different practiceItemIds for at least one pair among several students', async () => {
      const { session, student: s1 } = await createSessionAndStudent('ex-map-random');
      const specs = [await service.getExerciseSpec(session, 1, s1.id)];
      // Create several students — at least one pair should differ with 5-choose-3 = 10 combos
      for (let i = 0; i < 5; i++) {
        const s = await studentRepo.save(studentRepo.create({
          sessionId: session.id, lessonId: session.lessonId,
          name: `Other-${i}`, currentTask: 1, currentPhase: 'practice',
        }));
        specs.push(await service.getExerciseSpec(session, 1, s.id));
      }
      const uniqueSets = new Set(specs.map(s => JSON.stringify(s.practiceItemIds!.sort())));
      expect(uniqueSets.size).toBeGreaterThan(1);
    });

    it('returns no practiceItemIds without studentId', async () => {
      const { session } = await createSessionAndStudent('ex-map-random');
      const spec = await service.getExerciseSpec(session, 1);
      expect(spec.practiceItemIds).toBeUndefined();
      // Falls back to sequential givenPlacements
      expect(spec.givenPlacements).toBeDefined();
      expect(Object.keys(spec.givenPlacements!)).toHaveLength(2);
    });

    it('throws NotFoundException for invalid studentId', async () => {
      const { session } = await createSessionAndStudent('ex-map-random');
      await expect(
        service.getExerciseSpec(session, 1, 'nonexistent-student'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── checkAnswer ──

  describe('checkAnswer', () => {
    it('grades quiz correctly — all correct → allCorrect: true', async () => {
      const { session, student } = await createSessionAndStudent('ex-quiz');
      const result = await service.checkAnswer(session, student.id, 1, { answers: [1, 0] });
      expect(result.type).toBe('quiz');
      expect(result.allCorrect).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.items.every(i => i.correct)).toBe(true);
    });

    it('grades quiz — partial correct', async () => {
      const { session, student } = await createSessionAndStudent('ex-quiz');
      const result = await service.checkAnswer(session, student.id, 1, { answers: [0, 0] });
      expect(result.allCorrect).toBe(false);
      // First question wrong, second correct
      expect(result.items[0].correct).toBe(false);
      expect(result.items[0].hint).toBe('Think again');
      expect(result.items[1].correct).toBe(true);
    });

    it('grades match correctly', async () => {
      const { session, student } = await createSessionAndStudent('ex-match');
      const result = await service.checkAnswer(session, student.id, 1, { pairs: ['skimming', 'scanning'] });
      expect(result.type).toBe('match');
      expect(result.allCorrect).toBe(true);
    });

    it('grades order correctly', async () => {
      const { session, student } = await createSessionAndStudent('ex-order');
      const result = await service.checkAnswer(session, student.id, 1, { order: ['Introduction', 'Body', 'Conclusion'] });
      expect(result.type).toBe('order');
      expect(result.allCorrect).toBe(true);
    });

    it('throws NotFoundException for unknown student', async () => {
      const { session } = await createSessionAndStudent('ex-quiz');
      await expect(
        service.checkAnswer(session, 'nonexistent-student-id', 1, { answers: [1, 0] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('recomputes practiceItemIds server-side for map random practice (ignores tampered client data)', async () => {
      const { session, student } = await createSessionAndStudent('ex-map-random');
      const spec = await service.getExerciseSpec(session, 1, student.id);
      // Build correct submission for assigned items
      const placements: Record<string, any> = {};
      const reasons: Record<string, any> = {};
      for (const id of spec.practiceItemIds!) {
        const expected = MAP_RANDOM_MANIFEST.readingSteps[0].answerKey.expected as Record<string, number[]>;
        placements[id] = { x: expected[id][0], y: expected[id][1] };
        reasons[id] = 'A sufficiently long reason for this item';
      }
      const result = await service.checkAnswer(session, student.id, 1, {
        placements, reasons,
        practiceItemIds: ['TAMPERED', 'DATA'], // client sends garbage
      });
      expect(result.type).toBe('map');
      // Server recomputed the correct IDs — should grade the assigned items
      // (items may include a trailing _llm feedback entry)
      const gradeItems = result.items.filter(i => i.idx !== '_llm');
      expect(gradeItems.length).toBe(spec.practiceItemIds!.length);
    }, 15000);
  });

  // ── buildCheckItems ──

  describe('buildCheckItems', () => {
    it('map: uses practiceItemIds to scope check items', () => {
      const ak = MAP_RANDOM_MANIFEST.readingSteps[0].answerKey;
      const data = {
        placements: { b: { x: -0.5, y: 0.5 }, d: { x: -0.5, y: -0.5 } },
        reasons: { b: 'reason for B here!', d: 'reason for D here!' },
        practiceItemIds: ['b', 'd'],
      };
      const gradeResult = {
        total: 100,
        byDimension: {
          b_placed: true, b_reasoned: true, b_positionScore: 100,
          d_placed: true, d_reasoned: true, d_positionScore: 100,
        },
      };
      const items = service.buildCheckItems(ak as any, data, gradeResult);
      const gradeItems = items.filter(i => i.idx !== '_llm');
      expect(gradeItems).toHaveLength(2);
      expect(gradeItems.map(i => i.idx).sort()).toEqual(['b', 'd']);
    });

    it('map: empty practiceItemIds falls back to sequential slice', () => {
      const ak = MAP_RANDOM_MANIFEST.readingSteps[0].answerKey;
      const data = {
        placements: { a: { x: 0.5, y: 0.5 }, b: { x: -0.5, y: 0.5 }, c: { x: 0.5, y: -0.5 } },
        reasons: { a: 'reason AAA', b: 'reason BBB', c: 'reason CCC' },
        practiceItemIds: [],
      };
      const gradeResult = {
        total: 100,
        byDimension: {
          a_placed: true, a_reasoned: true, a_positionScore: 100,
          b_placed: true, b_reasoned: true, b_positionScore: 100,
          c_placed: true, c_reasoned: true, c_positionScore: 100,
        },
      };
      const items = service.buildCheckItems(ak as any, data, gradeResult);
      const gradeItems = items.filter(i => i.idx !== '_llm');
      // practiceCount=3, sequential: first 3 items (a, b, c)
      expect(gradeItems).toHaveLength(3);
      expect(gradeItems.map(i => i.idx).sort()).toEqual(['a', 'b', 'c']);
    });

    it('returns hint/walkthrough for wrong quiz answers', () => {
      const ak = QUIZ_MANIFEST.readingSteps[0].answerKey;
      const data = { answers: [0, 1] };
      const gradeResult = { total: 0, byDimension: { q0: false, q1: false } };
      const items = service.buildCheckItems(ak as any, data, gradeResult);
      expect(items[0].correct).toBe(false);
      expect(items[0].hint).toBe('Think again');
      expect(items[0].walkthrough).toBe('Answer is B');
    });

    it('returns correct items for select-evidence', () => {
      const ak = SE_MANIFEST.readingSteps[0].answerKey;
      const data = { sections: { sec1: { function: 'cause-effect', picked: ['1:1'] } } };
      const gradeResult = { total: 100, byDimension: {} };
      const items = service.buildCheckItems(ak as any, data, gradeResult);
      expect(items[0].idx).toBe('sec1');
      expect(items[0].correct).toBe(true);
      expect(items[0].aiMessage).toBe('Great!');
    });

    it('returns hint for wrong select-evidence function', () => {
      const ak = SE_MANIFEST.readingSteps[0].answerKey;
      const data = { sections: { sec1: { function: 'compare-contrast', picked: [] } } };
      const gradeResult = { total: 0, byDimension: {} };
      const items = service.buildCheckItems(ak as any, data, gradeResult);
      expect(items[0].correct).toBe(false);
      expect(items[0].hint).toBe('Try cause');
      expect(items[0].aiMessage).toBe('Not quite');
    });
  });
});
