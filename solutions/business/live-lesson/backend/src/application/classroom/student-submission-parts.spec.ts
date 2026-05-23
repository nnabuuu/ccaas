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

const mockObserverEngine = {
  dispatch: jest.fn().mockResolvedValue(undefined),
  setSessionMeta: jest.fn(),
  clearSessionMeta: jest.fn(),
  register: jest.fn(),
};

/** A manifest with a rich-content-quiz step containing 2 parts, each allowing maxImages: 3. */
const RICH_QUIZ_MANIFEST = {
  id: 'ci-rich-parts',
  title: 'Rich Content Parts Lesson',
  readingSteps: [{
    idx: 1, id: 'apply-basic', type: 'task', label: 'Apply',
    answerKey: {
      type: 'rich-content-quiz',
      subType: 'calculation',
      aiSystemPrompt: 'Grade the math exercise.',
      parts: [
        {
          id: 'p1',
          prompt: '(1) Compute (3x+2)(3x-2)',
          rubric: [{ id: 'c1', label: 'Correct', weight: 100, criteria: 'Answer is 9x²-4' }],
          sampleSolution: '9x²-4',
          maxImages: 3,
          scaffold: {
            threshold: 50,
            levels: [
              { hintZh: 'Hint L1: a=3x, b=2' },
              { hintZh: 'Hint L2: (3x)²-2²=9x²-4' },
            ],
          },
        },
        {
          id: 'p2',
          prompt: '(2) Compute (1+3a)(1-3a)',
          rubric: [{ id: 'c2', label: 'Correct', weight: 100, criteria: 'Answer is 1-9a²' }],
          sampleSolution: '1-9a²',
          maxImages: 3,
        },
      ],
    },
  }],
};

describe('StudentSubmissionService — submitPart multi-image', () => {
  let module: TestingModule;
  let service: StudentSubmissionService;
  let studentRepo: Repository<Student>;
  let submissionRepo: Repository<Submission>;
  let lessonRepo: Repository<Lesson>;
  let sessionRepo: Repository<ClassroomSession>;
  let gradeSpy: jest.SpyInstance;

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
        StudentSubmissionService,
        GradingService,
        ManifestCacheService,
        StateCacheService,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
        {
          provide: AiPromptBuilder,
          useValue: {
            callLlm: jest.fn().mockRejectedValue(new Error('not configured')),
            callVisionLlm: jest.fn().mockResolvedValue(JSON.stringify({
              dimensions: [{ id: 'c1', score: 3, comment: 'Perfect' }],
              feedback: 'Good job',
              errorTags: [],
            })),
          },
        },
      ],
    }).compile();

    service = module.get(StudentSubmissionService);
    studentRepo = module.get(getRepositoryToken(Student));
    submissionRepo = module.get(getRepositoryToken(Submission));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));

    await lessonRepo.save(lessonRepo.create({
      id: RICH_QUIZ_MANIFEST.id,
      title: RICH_QUIZ_MANIFEST.title,
      subject: 'Math',
      gradeLevel: '8',
      manifestJson: JSON.stringify(RICH_QUIZ_MANIFEST),
    }));

    // Spy on GradingService.grade to inspect what gets passed through
    gradeSpy = jest.spyOn(module.get(GradingService), 'grade');
  });

  afterAll(async () => { await module.close(); });

  afterEach(() => { gradeSpy.mockClear(); });

  async function setup() {
    const session = await sessionRepo.save(sessionRepo.create({
      lessonId: RICH_QUIZ_MANIFEST.id,
      code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: 'active',
      currentStep: 0,
    }));
    const student = await studentRepo.save(studentRepo.create({
      sessionId: session.id,
      lessonId: session.lessonId,
      name: `S-${Date.now()}`,
      currentTask: 1,
      currentPhase: 'practice',
    }));
    return { session, student };
  }

  it('passes all images to grader for a multi-image part submission', async () => {
    const { session, student } = await setup();
    const images = [
      'data:image/jpeg;base64,page1data',
      'data:image/jpeg;base64,page2data',
      'data:image/jpeg;base64,page3data',
    ];

    const result = await service.submit(session, student.id, 1, {
      partId: 'p1',
      images,
    });

    expect(result.ok).toBe(true);

    // Verify GradingService.grade received the synthetic key + all images
    expect(gradeSpy).toHaveBeenCalledTimes(1);
    const [syntheticKey, gradeData] = gradeSpy.mock.calls[0];
    expect(syntheticKey.type).toBe('image-upload');
    expect(syntheticKey.rubric[0].id).toBe('c1');
    expect(gradeData.images).toEqual(images);
    expect(gradeData.images).toHaveLength(3);
  });

  it('records multi-image array in attemptsHistory and partProgress', async () => {
    const { session, student } = await setup();
    const images = ['data:image/jpeg;base64,p1', 'data:image/jpeg;base64,p2'];

    await service.submit(session, student.id, 1, { partId: 'p1', images });

    const sub = await submissionRepo.findOne({
      where: { sessionId: session.id, studentId: student.id, step: 1, phase: 'exercise' },
    });
    const data = sub!.dataJson as Record<string, any>;

    // partProgress.images stores latest images
    expect(data.parts.p1.images).toEqual(images);

    // attemptsHistory records each attempt with its images
    expect(data.parts.p1.attemptsHistory).toHaveLength(1);
    expect(data.parts.p1.attemptsHistory[0].images).toEqual(images);
  });

  it('passes updated images on scaffold retry (second attempt)', async () => {
    const { session, student } = await setup();

    // Override grader to return a low score → triggers scaffold
    gradeSpy.mockResolvedValueOnce({ total: 30, byDimension: { c1: 1 } });

    const firstImages = ['data:image/jpeg;base64,attempt1_p1'];
    const r1 = await service.submit(session, student.id, 1, { partId: 'p1', images: firstImages });
    expect(r1.ok).toBe(true);
    expect(r1.scaffold).toBeDefined();
    expect(r1.scaffold!.level).toBe(0);

    // Second attempt with new (multi-page) images after seeing hint
    gradeSpy.mockResolvedValueOnce({ total: 100, byDimension: { c1: 3 } });

    const retryImages = ['data:image/jpeg;base64,retry_p1', 'data:image/jpeg;base64,retry_p2'];
    const r2 = await service.submit(session, student.id, 1, { partId: 'p1', images: retryImages });
    expect(r2.ok).toBe(true);

    // Verify second call got the new images
    expect(gradeSpy).toHaveBeenCalledTimes(2);
    const [, retryData] = gradeSpy.mock.calls[1];
    expect(retryData.images).toEqual(retryImages);

    // Check attemptsHistory has both attempts with correct images
    const sub = await submissionRepo.findOne({
      where: { sessionId: session.id, studentId: student.id, step: 1, phase: 'exercise' },
    });
    const parts = (sub!.dataJson as Record<string, any>).parts;
    expect(parts.p1.attemptsHistory).toHaveLength(2);
    expect(parts.p1.attemptsHistory[0].images).toEqual(firstImages);
    expect(parts.p1.attemptsHistory[1].images).toEqual(retryImages);
    // Latest images should be the retry
    expect(parts.p1.images).toEqual(retryImages);
  });

  it('single-image part submission still works (no regression)', async () => {
    const { session, student } = await setup();
    const images = ['data:image/jpeg;base64,single'];

    const result = await service.submit(session, student.id, 1, { partId: 'p2', images });
    expect(result.ok).toBe(true);

    expect(gradeSpy).toHaveBeenCalledTimes(1);
    const [, gradeData] = gradeSpy.mock.calls[0];
    expect(gradeData.images).toEqual(images);
    expect(gradeData.images).toHaveLength(1);
  });

  it('returns sampleSolution when part is completed via correct answer', async () => {
    const { session, student } = await setup();
    // Default mock returns score 100 → part completed
    const result = await service.submit(session, student.id, 1, {
      partId: 'p1',
      images: ['data:image/jpeg;base64,correct'],
    });
    expect(result.ok).toBe(true);
    expect(result.sampleSolution).toBe('9x²-4');
  });

  it('returns sampleSolution when part is completed via pass', async () => {
    const { session, student } = await setup();
    // First submit with low score → scaffold
    gradeSpy.mockResolvedValueOnce({ total: 30, byDimension: { c1: 1 } });
    await service.submit(session, student.id, 1, {
      partId: 'p1',
      images: ['data:image/jpeg;base64,attempt1'],
    });

    // Pass the part
    const passResult = await service.submit(session, student.id, 1, {
      partId: 'p1',
      _pass: true,
      images: [],
    });
    expect(passResult.ok).toBe(true);
    expect(passResult.sampleSolution).toBe('9x²-4');
  });

  it('stores sampleSolution in partProgress for review restore', async () => {
    const { session, student } = await setup();
    await service.submit(session, student.id, 1, {
      partId: 'p1',
      images: ['data:image/jpeg;base64,correct'],
    });

    const sub = await submissionRepo.findOne({
      where: { sessionId: session.id, studentId: student.id, step: 1, phase: 'exercise' },
    });
    const data = sub!.dataJson as Record<string, any>;
    expect(data.parts.p1.sampleSolution).toBe('9x²-4');
  });

  it('does not return sampleSolution when part triggers scaffold (not completed)', async () => {
    const { session, student } = await setup();
    gradeSpy.mockResolvedValueOnce({ total: 30, byDimension: { c1: 1 } });
    const result = await service.submit(session, student.id, 1, {
      partId: 'p1',
      images: ['data:image/jpeg;base64,wrong'],
    });
    expect(result.ok).toBe(true);
    expect(result.scaffold).toBeDefined();
    expect(result.sampleSolution).toBeNull();
  });

  // --- Correctness-based scaffold logic (bug fix coverage) ---

  it('wrong answer on part WITHOUT scaffold returns synthesized retry scaffold', async () => {
    const { session, student } = await setup();
    // p2 has no scaffold defined
    gradeSpy.mockResolvedValueOnce({ total: 50, byDimension: { c2: 1 }, llmFeedback: '常数项未正确平方' });
    const result = await service.submit(session, student.id, 1, {
      partId: 'p2',
      images: ['data:image/jpeg;base64,wrong'],
    });
    expect(result.ok).toBe(true);
    expect(result.scaffold).toBeDefined();
    expect(result.scaffold!.canRetry).toBe(true);
    expect(result.scaffold!.level).toBe(0);
    expect(result.scaffold!.hintZh).toBe('常数项未正确平方');
    // Part should NOT be completed
    expect(result.nextPartId).toBeNull();
    expect(result.sampleSolution).toBeNull();
  });

  it('wrong answer on part WITHOUT scaffold uses default hint when no llmFeedback', async () => {
    const { session, student } = await setup();
    gradeSpy.mockResolvedValueOnce({ total: 40, byDimension: { c2: 1 } });
    const result = await service.submit(session, student.id, 1, {
      partId: 'p2',
      images: ['data:image/jpeg;base64,wrong'],
    });
    expect(result.scaffold).toBeDefined();
    expect(result.scaffold!.hintZh).toBe('答案不正确，请重新检查你的计算过程。');
  });

  it('wrong answer on part WITHOUT scaffold allows retry then accepts correct answer', async () => {
    const { session, student } = await setup();
    // First: wrong
    gradeSpy.mockResolvedValueOnce({ total: 50, byDimension: { c2: 1 } });
    const r1 = await service.submit(session, student.id, 1, {
      partId: 'p2',
      images: ['data:image/jpeg;base64,wrong'],
    });
    expect(r1.scaffold).toBeDefined();
    expect(r1.scaffold!.canRetry).toBe(true);

    // Second: correct
    gradeSpy.mockResolvedValueOnce({ total: 100, byDimension: { c2: 3 } });
    const r2 = await service.submit(session, student.id, 1, {
      partId: 'p2',
      images: ['data:image/jpeg;base64,correct'],
    });
    expect(r2.scaffold).toBeUndefined();
    expect(r2.sampleSolution).toBe('1-9a²');
  });

  it('high-score wrong answer (e.g. 60) on part WITH scaffold still triggers scaffold', async () => {
    const { session, student } = await setup();
    // p1 has scaffold with threshold=50, but the new logic ignores threshold —
    // any score < 100 triggers scaffold
    gradeSpy.mockResolvedValueOnce({ total: 60, byDimension: { c1: 2 } });
    const result = await service.submit(session, student.id, 1, {
      partId: 'p1',
      images: ['data:image/jpeg;base64,almost'],
    });
    expect(result.ok).toBe(true);
    expect(result.scaffold).toBeDefined();
    expect(result.scaffold!.level).toBe(0);
    expect(result.scaffold!.hintZh).toBe('Hint L1: a=3x, b=2');
    expect(result.sampleSolution).toBeNull();
  });

  it('score=100 marks part completed even when scaffold is configured', async () => {
    const { session, student } = await setup();
    // p1 has scaffold, but score=100 → correct → skip scaffold
    gradeSpy.mockResolvedValueOnce({ total: 100, byDimension: { c1: 3 } });
    const result = await service.submit(session, student.id, 1, {
      partId: 'p1',
      images: ['data:image/jpeg;base64,perfect'],
    });
    expect(result.ok).toBe(true);
    expect(result.scaffold).toBeUndefined();
    expect(result.sampleSolution).toBe('9x²-4');
  });

  it('wrong answer on no-scaffold part persists completed=false in DB', async () => {
    const { session, student } = await setup();
    gradeSpy.mockResolvedValueOnce({ total: 40, byDimension: { c2: 1 } });
    await service.submit(session, student.id, 1, {
      partId: 'p2',
      images: ['data:image/jpeg;base64,wrong'],
    });

    const sub = await submissionRepo.findOne({
      where: { sessionId: session.id, studentId: student.id, step: 1, phase: 'exercise' },
    });
    const data = sub!.dataJson as Record<string, any>;
    expect(data.parts.p2.completed).toBe(false);
    expect(data.parts.p2.attempts).toBe(1);
  });

  it('_pass on no-scaffold part is rejected (scaffoldLevel never bumped)', async () => {
    const { session, student } = await setup();
    // Wrong answer on p2 (no scaffold) → synthesized scaffold, but scaffoldLevel stays -1
    gradeSpy.mockResolvedValueOnce({ total: 50, byDimension: { c2: 1 } });
    await service.submit(session, student.id, 1, {
      partId: 'p2',
      images: ['data:image/jpeg;base64,wrong'],
    });

    // Try to pass — rejected because scaffoldLevel is -1 (passPart guard)
    const passResult = await service.submit(session, student.id, 1, {
      partId: 'p2',
      _pass: true,
      images: [],
    });
    expect(passResult.ok).toBe(false);
  });

  it('multiple retries on no-scaffold part all return canRetry=true', async () => {
    const { session, student } = await setup();
    for (let i = 0; i < 3; i++) {
      gradeSpy.mockResolvedValueOnce({ total: 30 + i * 10, byDimension: { c2: 1 } });
      const result = await service.submit(session, student.id, 1, {
        partId: 'p2',
        images: [`data:image/jpeg;base64,attempt${i}`],
      });
      expect(result.scaffold).toBeDefined();
      expect(result.scaffold!.canRetry).toBe(true);
    }

    const sub = await submissionRepo.findOne({
      where: { sessionId: session.id, studentId: student.id, step: 1, phase: 'exercise' },
    });
    const data = sub!.dataJson as Record<string, any>;
    expect(data.parts.p2.attempts).toBe(3);
    expect(data.parts.p2.completed).toBe(false);
  });
});
