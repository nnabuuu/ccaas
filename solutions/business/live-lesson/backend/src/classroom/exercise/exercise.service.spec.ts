import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExerciseService } from './exercise.service';
import { GradingService } from './grading.service';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { ObservationEvent } from '../../entities/observation-event.entity';
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
          entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion, ObservationEvent],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, Submission, ClassroomSession, AiQuestion, ObservationEvent]),
      ],
      providers: [ExerciseService, GradingService, AiPromptBuilder],
    }).compile();

    service = module.get(ExerciseService);
    studentRepo = module.get(getRepositoryToken(Student));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));

    // Seed lessons
    for (const m of [QUIZ_MANIFEST, MATCH_MANIFEST, ORDER_MANIFEST, SE_MANIFEST, NO_KEY_MANIFEST]) {
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
  });

  // ── buildCheckItems ──

  describe('buildCheckItems', () => {
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
