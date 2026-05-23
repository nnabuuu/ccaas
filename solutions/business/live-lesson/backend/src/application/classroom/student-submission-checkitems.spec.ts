import { LLM_PORT } from '../../domain/ports/llm.port';
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryModule } from '@nestjs/core';
import { PLUGIN_PROVIDERS } from '../exercise/test-utils';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StudentSubmissionService } from './student-submission.service';
import { GradingService } from '../exercise/grading.service';
import { ManifestCacheService } from '../classroom/manifest-cache.service';
import { StateCacheService } from '../../adapters/transport/state-cache.service';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';
import { Student } from '../../adapters/persistence/entities/student.entity';
import { Submission } from '../../adapters/persistence/entities/submission.entity';
import { ClassroomSession } from '../../adapters/persistence/entities/classroom-session.entity';
import { AiQuestion } from '../../adapters/persistence/entities/ai-question.entity';
import { ClassroomSnapshot } from '../../adapters/persistence/entities/classroom-snapshot.entity';
import { Lesson } from '../../adapters/persistence/entities/lesson.entity';
import { OBSERVER_ENGINE } from '@kedge-agentic/observer-engine';
import { SUBMISSION_REPO_PORT } from '../../domain/ports/submission-repo.port';
import { TypeOrmSubmissionRepository } from '../../adapters/persistence/repositories/submission.repository';
import { STUDENT_REPO_PORT } from "../../domain/ports/student-repo.port";
import { TypeOrmStudentRepository } from "../../adapters/persistence/repositories/student.repository";

const mockObserverEngine = {
  dispatch: jest.fn().mockResolvedValue(undefined),
  setSessionMeta: jest.fn(),
  clearSessionMeta: jest.fn(),
  register: jest.fn(),
};

const QUIZ_MANIFEST = {
  id: 'ci-quiz',
  title: 'Quiz Lesson',
  readingSteps: [{
    idx: 1, label: 'Quiz Step', strategy: 'quiz',
    answerKey: {
      type: 'quiz',
      answers: [
        { questionIdx: 0, correct: 1, hint: 'Hint0' },
        { questionIdx: 1, correct: 0 },
      ],
    },
  }],
};

const ORDER_MANIFEST = {
  id: 'ci-order',
  title: 'Order Lesson',
  readingSteps: [{
    idx: 1, label: 'Order Step', strategy: 'order',
    answerKey: {
      type: 'order',
      items: ['A', 'B', 'C'],
      correctOrder: [0, 1, 2],
    },
  }],
};

const NO_AK_MANIFEST = {
  id: 'ci-noak',
  title: 'No AK',
  readingSteps: [{ idx: 1, label: 'Read', strategy: 'read' }],
};

describe('StudentSubmissionService — getProgress checkItems', () => {
  let module: TestingModule;
  let service: StudentSubmissionService;
  let studentRepo: Repository<Student>;
  let submissionRepo: Repository<Submission>;
  let lessonRepo: Repository<Lesson>;
  let sessionRepo: Repository<ClassroomSession>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DiscoveryModule,
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
        ...PLUGIN_PROVIDERS,
        { provide: LLM_PORT, useExisting: AiPromptBuilder },
        TypeOrmSubmissionRepository,
        { provide: SUBMISSION_REPO_PORT, useExisting: TypeOrmSubmissionRepository },
        TypeOrmStudentRepository,
        { provide: STUDENT_REPO_PORT, useExisting: TypeOrmStudentRepository },
        StudentSubmissionService,
        GradingService,
        ManifestCacheService,
        StateCacheService,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
        {
          provide: AiPromptBuilder,
          useValue: { callLlm: jest.fn().mockRejectedValue(new Error('not configured')) },
        },
      ],
    }).compile();

    service = module.get(StudentSubmissionService);
    studentRepo = module.get(getRepositoryToken(Student));
    submissionRepo = module.get(getRepositoryToken(Submission));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));

    for (const m of [QUIZ_MANIFEST, ORDER_MANIFEST, NO_AK_MANIFEST]) {
      await lessonRepo.save(lessonRepo.create({
        id: m.id, title: m.title, subject: 'English', gradeLevel: '7',
        manifestJson: JSON.stringify(m),
      }));
    }
  });

  afterAll(async () => { await module.close(); });

  async function setup(lessonId: string) {
    const session = await sessionRepo.save(sessionRepo.create({
      lessonId, code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: 'active', currentStep: 0,
    }));
    const student = await studentRepo.save(studentRepo.create({
      sessionId: session.id, lessonId, name: `S-${Date.now()}`,
      currentTask: 1, currentPhase: 'practice',
    }));
    return { session, student };
  }

  it('returns checkItems for quiz submission with score', async () => {
    const { session, student } = await setup('ci-quiz');

    // Seed a graded submission
    await submissionRepo.save(submissionRepo.create({
      sessionId: session.id, lessonId: session.lessonId, studentId: student.id,
      step: 1, phase: 'exercise',
      dataJson: { answers: [1, 0] },
      scoreJson: { total: 100, byDimension: { q0: true, q1: true } },
    }));

    const progress = await service.getProgress(session, student.id, true);
    expect(progress).not.toBeNull();
    expect(progress!.submissions).toBeDefined();
    const sub = progress!.submissions![1];
    expect(sub.checkItems).toBeDefined();
    expect(sub.checkItems).toHaveLength(2);
    expect(sub.checkItems![0]).toEqual({ idx: 0, correct: true });
    expect(sub.checkItems![1]).toEqual({ idx: 1, correct: true });
  });

  it('returns checkItems with hints for partially correct quiz', async () => {
    const { session, student } = await setup('ci-quiz');

    await submissionRepo.save(submissionRepo.create({
      sessionId: session.id, lessonId: session.lessonId, studentId: student.id,
      step: 1, phase: 'exercise',
      dataJson: { answers: [0, 0] },
      scoreJson: { total: 50, byDimension: { q0: false, q1: true } },
    }));

    const progress = await service.getProgress(session, student.id, true);
    const sub = progress!.submissions![1];
    expect(sub.checkItems![0]).toEqual({ idx: 0, correct: false, hint: 'Hint0' });
    expect(sub.checkItems![1]).toEqual({ idx: 1, correct: true });
  });

  it('omits checkItems when score is null', async () => {
    const { session, student } = await setup('ci-quiz');

    await submissionRepo.save(submissionRepo.create({
      sessionId: session.id, lessonId: session.lessonId, studentId: student.id,
      step: 1, phase: 'exercise',
      dataJson: { answers: [1, 0] },
      scoreJson: null,
    }));

    const progress = await service.getProgress(session, student.id, true);
    const sub = progress!.submissions![1];
    expect(sub.checkItems).toBeUndefined();
  });

  it('omits checkItems when step has no answerKey', async () => {
    const { session, student } = await setup('ci-noak');

    await submissionRepo.save(submissionRepo.create({
      sessionId: session.id, lessonId: session.lessonId, studentId: student.id,
      step: 1, phase: 'exercise',
      dataJson: {},
      scoreJson: { total: 0, byDimension: {} },
    }));

    const progress = await service.getProgress(session, student.id, true);
    const sub = progress!.submissions![1];
    expect(sub.checkItems).toBeUndefined();
  });

  it('does not include submissions when includeSubmissions is false', async () => {
    const { session, student } = await setup('ci-quiz');

    await submissionRepo.save(submissionRepo.create({
      sessionId: session.id, lessonId: session.lessonId, studentId: student.id,
      step: 1, phase: 'exercise',
      dataJson: { answers: [1, 0] },
      scoreJson: { total: 100, byDimension: { q0: true, q1: true } },
    }));

    const progress = await service.getProgress(session, student.id, false);
    expect(progress!.submissions).toBeUndefined();
  });

  it('returns checkItems for order submission', async () => {
    const { session, student } = await setup('ci-order');

    await submissionRepo.save(submissionRepo.create({
      sessionId: session.id, lessonId: session.lessonId, studentId: student.id,
      step: 1, phase: 'exercise',
      dataJson: { order: ['A', 'B', 'C'] },
      scoreJson: { total: 100, byDimension: {} },
    }));

    const progress = await service.getProgress(session, student.id, true);
    const sub = progress!.submissions![1];
    expect(sub.checkItems).toBeDefined();
    expect(sub.checkItems).toHaveLength(3);
    expect(sub.checkItems!.every((i: any) => i.correct)).toBe(true);
  });
});
