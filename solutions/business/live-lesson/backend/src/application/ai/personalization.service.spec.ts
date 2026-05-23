import { LLM_PORT } from '../../domain/ports/llm.port';
import { DISCUSS_HIGHLIGHT_REPO_PORT } from "../../domain/ports/discuss-highlight-repo.port";
import { TypeOrmDiscussHighlightRepository } from "../../adapters/persistence/repositories/discuss-highlight.repository";
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryModule } from '@nestjs/core';
import { PLUGIN_PROVIDERS } from '../exercise/test-utils';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PersonalizationService } from './personalization.service';
import { ExerciseService } from '../exercise/exercise.service';
import { GradingService } from '../exercise/grading.service';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';
import { ManifestCacheService } from '../classroom/manifest-cache.service';
import { CoachingService } from '../observation/coaching.service';
import { StateCacheService } from '../../adapters/transport/state-cache.service';
import { Student } from '../../adapters/persistence/entities/student.entity';
import { Submission } from '../../adapters/persistence/entities/submission.entity';
import { ClassroomSession } from '../../adapters/persistence/entities/classroom-session.entity';
import { AiQuestion } from '../../adapters/persistence/entities/ai-question.entity';
import { ChatMessage } from '../../adapters/persistence/entities/chat-message.entity';
import { ClassroomSnapshot } from '../../adapters/persistence/entities/classroom-snapshot.entity';
import { Lesson } from '../../adapters/persistence/entities/lesson.entity';
import { DiscussHighlight } from '../../adapters/persistence/entities/discuss-highlight.entity';

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
  let aiQuestionRepo: Repository<AiQuestion>;
  let chatMessageRepo: Repository<ChatMessage>;
  let coachingService: CoachingService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DiscoveryModule,
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ClassroomSnapshot, DiscussHighlight],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ClassroomSnapshot, DiscussHighlight]),
      ],
      providers: [
        { provide: LLM_PORT, useExisting: AiPromptBuilder },
        TypeOrmDiscussHighlightRepository,
        { provide: DISCUSS_HIGHLIGHT_REPO_PORT, useExisting: TypeOrmDiscussHighlightRepository },
        ...PLUGIN_PROVIDERS,PersonalizationService, ExerciseService, GradingService, AiPromptBuilder, ManifestCacheService, CoachingService, StateCacheService],
    }).compile();

    service = module.get(PersonalizationService);
    studentRepo = module.get(getRepositoryToken(Student));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    submissionRepo = module.get(getRepositoryToken(Submission));
    aiPromptBuilder = module.get(AiPromptBuilder);
    aiQuestionRepo = module.get(getRepositoryToken(AiQuestion));
    chatMessageRepo = module.get(getRepositoryToken(ChatMessage));
    coachingService = module.get(CoachingService);

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
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue('You did great!');

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
      jest.spyOn(aiPromptBuilder, 'callLlm').mockResolvedValue('Keep going!');

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

  // ── getStudentRecap ──

  describe('getStudentRecap', () => {
    it('throws NotFoundException for unknown student', async () => {
      const { session } = await createSessionAndStudent('pt-lesson');
      await expect(
        service.getStudentRecap(session, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns empty recap for student with no activity', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');
      const result = await service.getStudentRecap(session, student.id);
      expect(result.highlights).toEqual([]);
      expect(result.aiStats).toEqual({ translateCount: 0, askCount: 0, discussRounds: 0 });
      expect(result.totalTime).toBeNull();
      expect(result.bonusCompleted).toBe(false);
    });

    it('computes tier from exercise submissions', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');
      await submissionRepo.save(submissionRepo.create({
        sessionId: session.id, lessonId: 'pt-lesson', studentId: student.id,
        step: 1, phase: 'exercise', dataJson: { answers: [1] }, scoreJson: { total: 90 },
      }));
      const result = await service.getStudentRecap(session, student.id);
      expect(result.tier).not.toBeNull();
      expect(result.tier!.labelEn).toBe('Excellent');
      expect(result.tier!.tone).toBe('gold');
    });

    it('returns null tier for lesson without personalTouch config', async () => {
      const { session, student } = await createSessionAndStudent('no-pt-lesson');
      const result = await service.getStudentRecap(session, student.id);
      expect(result.tier).toBeNull();
    });

    it('counts askCount excluding discuss-category questions', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');
      // Regular ask question
      await aiQuestionRepo.save(aiQuestionRepo.create({
        sessionId: session.id, studentId: student.id, studentName: 'C',
        step: 1, question: 'Q1', answer: 'A1', category: '理解',
      }));
      // Discuss-category question (should be excluded)
      await aiQuestionRepo.save(aiQuestionRepo.create({
        sessionId: session.id, studentId: student.id, studentName: 'C',
        step: 1, question: 'Q2', answer: 'A2', category: 'discuss',
      }));
      // NULL-category question (should still be included)
      await aiQuestionRepo.save(aiQuestionRepo.create({
        sessionId: session.id, studentId: student.id, studentName: 'C',
        step: 1, question: 'Q3', answer: 'A3', category: null as any,
      }));
      const result = await service.getStudentRecap(session, student.id);
      expect(result.aiStats.askCount).toBe(2);
    });

    it('counts translate threads from chat messages', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');
      // Two messages in one translate thread
      await chatMessageRepo.save(chatMessageRepo.create({
        sessionId: session.id, studentId: student.id,
        threadId: 'translate:1:abc12345', role: 'student', content: 'what?', seq: 0,
      }));
      await chatMessageRepo.save(chatMessageRepo.create({
        sessionId: session.id, studentId: student.id,
        threadId: 'translate:1:abc12345', role: 'ai', content: 'reply', seq: 1,
      }));
      // Another translate thread
      await chatMessageRepo.save(chatMessageRepo.create({
        sessionId: session.id, studentId: student.id,
        threadId: 'translate:2:def67890', role: 'student', content: 'hmm?', seq: 0,
      }));
      // Non-translate thread (should not count)
      await chatMessageRepo.save(chatMessageRepo.create({
        sessionId: session.id, studentId: student.id,
        threadId: 'ask:1:xyz', role: 'student', content: 'hi', seq: 0,
      }));
      const result = await service.getStudentRecap(session, student.id);
      expect(result.aiStats.translateCount).toBe(2);
    });

    it('counts discuss rounds from submissions', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');
      await submissionRepo.save(submissionRepo.create({
        sessionId: session.id, lessonId: 'pt-lesson', studentId: student.id,
        step: 1, phase: 'discuss', dataJson: { summary: 'x' }, scoreJson: null,
      }));
      await submissionRepo.save(submissionRepo.create({
        sessionId: session.id, lessonId: 'pt-lesson', studentId: student.id,
        step: 2, phase: 'discuss', dataJson: { summary: 'y' }, scoreJson: null,
      }));
      const result = await service.getStudentRecap(session, student.id);
      expect(result.aiStats.discussRounds).toBe(2);
    });

    it('computes totalTime from joinedAt to last submission', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');
      // Backdate joinedAt so there's a measurable gap
      await studentRepo.update(student.id, { joinedAt: new Date(Date.now() - 120_000) });
      await submissionRepo.save(submissionRepo.create({
        sessionId: session.id, lessonId: 'pt-lesson', studentId: student.id,
        step: 1, phase: 'exercise', dataJson: { answers: [1] }, scoreJson: { total: 50 },
      }));
      const result = await service.getStudentRecap(session, student.id);
      expect(result.totalTime).not.toBeNull();
      expect(result.totalTime!).toBeGreaterThanOrEqual(100); // ~120s with some tolerance
    });

    it('detects bonusCompleted when step >= 101 exists', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');
      await submissionRepo.save(submissionRepo.create({
        sessionId: session.id, lessonId: 'pt-lesson', studentId: student.id,
        step: 101, phase: 'exercise', dataJson: { answers: [0] }, scoreJson: { total: 100 },
      }));
      const result = await service.getStudentRecap(session, student.id);
      expect(result.bonusCompleted).toBe(true);
    });

    it('bonusCompleted is false when only normal steps exist', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');
      await submissionRepo.save(submissionRepo.create({
        sessionId: session.id, lessonId: 'pt-lesson', studentId: student.id,
        step: 1, phase: 'exercise', dataJson: { answers: [1] }, scoreJson: { total: 80 },
      }));
      const result = await service.getStudentRecap(session, student.id);
      expect(result.bonusCompleted).toBe(false);
    });

    it('returns highlights from coaching service filtered by studentId', async () => {
      const { session, student } = await createSessionAndStudent('pt-lesson');
      coachingService.addHighlight(session.id, {
        studentId: student.id, studentName: 'C', taskNum: 1,
        clusterId: 'c1', message: 'msg', gist: 'great insight', evidenceSpan: 'the key quote',
      });
      coachingService.addHighlight(session.id, {
        studentId: 'other-student', studentName: 'D', taskNum: 1,
        clusterId: 'c1', message: 'msg2', gist: 'other gist', evidenceSpan: 'other span',
      });
      const result = await service.getStudentRecap(session, student.id);
      expect(result.highlights).toHaveLength(1);
      expect(result.highlights[0].gist).toBe('great insight');
      expect(result.highlights[0].evidenceSpan).toBe('the key quote');
    });
  });
});
