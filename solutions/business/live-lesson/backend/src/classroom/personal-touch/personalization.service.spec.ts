import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PersonalizationService } from './personalization.service';
import { ExerciseService } from '../exercise/exercise.service';
import { GradingService } from '../exercise/grading.service';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { ObservationEvent } from '../../entities/observation-event.entity';
import { ClassroomSnapshot } from '../../entities/classroom-snapshot.entity';
import { Lesson } from '../../entities/lesson.entity';

const PT_MANIFEST = {
  id: 'pt-lesson',
  title: 'Personal Touch Lesson',
  readingSteps: [
    {
      idx: 1, label: 'Quiz Step', strategy: 'quiz', type: 'task',
      answerKey: {
        type: 'quiz',
        answers: [{ questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] }],
      },
    },
  ],
  personalTouch: {
    strategyLabels: [
      { taskIdx: 1, strategy: 'skimming', emoji: '📖' },
    ],
    tiers: [
      { minScore: 80, label: '优秀', labelEn: 'Excellent', tone: 'gold' },
      { minScore: 50, label: '良好', labelEn: 'Good', tone: 'blue' },
      { minScore: 0, label: '加油', labelEn: 'Keep Going', tone: 'neutral' },
    ],
  },
  bonusSteps: [
    {
      idx: 1, type: 'task',
      label: 'Bonus Quiz', labelEn: 'Bonus Quiz', strategy: 'quiz',
      answerKey: {
        type: 'quiz',
        answers: [{ questionIdx: 0, correct: 0, questionText: 'BQ1', options: ['X', 'Y'] }],
      },
    },
  ],
};

const NO_PT_MANIFEST = {
  id: 'no-pt-lesson',
  title: 'No Personal Touch',
  readingSteps: [
    { idx: 1, label: 'Quiz', strategy: 'quiz', type: 'task',
      answerKey: { type: 'quiz', answers: [{ questionIdx: 0, correct: 0, questionText: 'Q', options: ['A', 'B'] }] },
    },
  ],
};

describe('PersonalizationService', () => {
  let module: TestingModule;
  let service: PersonalizationService;
  let studentRepo: Repository<Student>;
  let lessonRepo: Repository<Lesson>;
  let sessionRepo: Repository<ClassroomSession>;
  let submissionRepo: Repository<Submission>;
  let aiPromptBuilder: AiPromptBuilder;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion, ObservationEvent, ClassroomSnapshot],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, Submission, ClassroomSession, AiQuestion, ObservationEvent, ClassroomSnapshot]),
      ],
      providers: [PersonalizationService, ExerciseService, GradingService, AiPromptBuilder],
    }).compile();

    service = module.get(PersonalizationService);
    studentRepo = module.get(getRepositoryToken(Student));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    submissionRepo = module.get(getRepositoryToken(Submission));
    aiPromptBuilder = module.get(AiPromptBuilder);

    for (const m of [PT_MANIFEST, NO_PT_MANIFEST]) {
      await lessonRepo.save(lessonRepo.create({
        id: m.id, title: m.title, subject: 'English', gradeLevel: '7',
        manifestJson: JSON.stringify(m),
      }));
    }
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function createSessionAndStudent(lessonId: string) {
    const session = await sessionRepo.save(sessionRepo.create({
      lessonId, code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: 'active', currentStep: 0,
    }));
    const student = await studentRepo.save(studentRepo.create({
      sessionId: session.id, lessonId: session.lessonId,
      name: `Charlie-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      currentTask: 1, currentPhase: 'personalTouch',
    }));
    return { session, student };
  }

  // ── getPersonalTouch ──

  describe('getPersonalTouch', () => {
    it('computes strategies, tier, AI comment for student with submissions', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');
      await submissionRepo.save(submissionRepo.create({
        sessionId: session.id, lessonId: 'pt-lesson', studentId: student.id,
        step: 1, dataJson: { answers: [1] }, scoreJson: { total: 100 },
      }));
      jest.spyOn(aiPromptBuilder, 'buildPersonalTouchPrompt').mockReturnValue({
        system: 'sys', user: 'usr',
      });
      jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValue('You did great!');

      const result = await service.getPersonalTouch(session, student.id);

      expect(result.strategies).toHaveLength(1);
      expect(result.strategies[0].score).toBe(100);
      expect(result.tier.labelEn).toBe('Excellent');
      expect(result.aiComment).toBe('You did great!');
    });

    it('returns empty fallback when personalTouch schema invalid', async () => {
      const { session, student } = await createSessionAndStudent('no-pt-lesson');
      const result = await service.getPersonalTouch(session, student.id);
      expect(result.strategies).toEqual([]);
      expect(result.tier.label).toBe('');
    });

    it('handles student with no submissions — tier is lowest', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');
      jest.spyOn(aiPromptBuilder, 'buildPersonalTouchPrompt').mockReturnValue({
        system: 'sys', user: 'usr',
      });
      jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValue('Keep going!');

      const result = await service.getPersonalTouch(session, student.id);
      // With no submissions, all strategy scores default to 0 → lowest tier
      expect(result.tier.labelEn).toBe('Keep Going');
      expect(result.aiComment).toBe('Keep going!');
      if (result.strategies.length > 0) {
        expect(result.strategies[0].score).toBe(0);
      }
    });

    it('throws NotFoundException for unknown student', async () => {
      const { session } = await createSessionAndStudent('pt-lesson');
      await expect(
        service.getPersonalTouch(session, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getBonusExercise ──

  describe('getBonusExercise', () => {
    it('returns sanitized spec for valid bonus step', async () => {
      const { session } = await createSessionAndStudent('pt-lesson');
      const result = await service.getBonusExercise(session, 1);
      expect(result.exercise.type).toBe('quiz');
      expect(result.label).toBe('Bonus Quiz');
    });

    it('throws for out-of-range bonusStep', async () => {
      const { session } = await createSessionAndStudent('pt-lesson');
      await expect(service.getBonusExercise(session, 99)).rejects.toThrow(BadRequestException);
    });

    it('throws for bonusStep 0', async () => {
      const { session } = await createSessionAndStudent('pt-lesson');
      await expect(service.getBonusExercise(session, 0)).rejects.toThrow(BadRequestException);
    });
  });

  // ── checkBonusAnswer ──

  describe('checkBonusAnswer', () => {
    it('grades, saves submission, returns check items', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');

      const result = await service.checkBonusAnswer(session, student.id, 1, { answers: [0] });

      expect(result.type).toBe('quiz');
      expect(result.allCorrect).toBe(true);

      // Verify submission saved with virtual step
      const sub = await submissionRepo.findOne({
        where: { sessionId: session.id, studentId: student.id, step: 101 },
      });
      expect(sub).not.toBeNull();
      expect(sub!.scoreJson.total).toBe(100);
    });

    it('upserts existing bonus submission on re-check', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');

      // First check — wrong answer
      await service.checkBonusAnswer(session, student.id, 1, { answers: [1] });
      // Second check — correct answer
      await service.checkBonusAnswer(session, student.id, 1, { answers: [0] });

      const subs = await submissionRepo.find({
        where: { sessionId: session.id, studentId: student.id, step: 101 },
      });
      expect(subs).toHaveLength(1);
      expect(subs[0].scoreJson.total).toBe(100);
    });

    it('throws NotFoundException for unknown student', async () => {
      const { session } = await createSessionAndStudent('pt-lesson');
      await expect(
        service.checkBonusAnswer(session, 'nonexistent', 1, { answers: [0] }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
