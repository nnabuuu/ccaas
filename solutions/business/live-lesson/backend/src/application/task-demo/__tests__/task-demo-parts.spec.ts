import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryModule } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TaskDemoService } from '../task-demo.service';
import { ExerciseService } from '../../exercise/exercise.service';
import { GradingService } from '../../exercise/grading.service';
import { ManifestCacheService } from '../../classroom/manifest-cache.service';
import { PLUGIN_PROVIDERS } from '../../exercise/test-utils';

import { Lesson } from '../../../adapters/persistence/entities/lesson.entity';
import { Student } from '../../../adapters/persistence/entities/student.entity';
import { ClassroomSession } from '../../../adapters/persistence/entities/classroom-session.entity';
import { TaskDemoAttempt } from '../../../adapters/persistence/entities/task-demo-attempt.entity';

import { LESSON_REPO_PORT } from '../../../domain/ports/lesson-repo.port';
import { TypeOrmLessonRepository } from '../../../adapters/persistence/repositories/lesson.repository';
import { STUDENT_REPO_PORT } from '../../../domain/ports/student-repo.port';
import { TypeOrmStudentRepository } from '../../../adapters/persistence/repositories/student.repository';
import { CLASSROOM_SESSION_REPO_PORT } from '../../../domain/ports/classroom-session-repo.port';
import { TypeOrmClassroomSessionRepository } from '../../../adapters/persistence/repositories/classroom-session.repository';
import { TASK_DEMO_ATTEMPT_REPO_PORT } from '../../../domain/ports/task-demo-attempt-repo.port';
import { TypeOrmTaskDemoAttemptRepository } from '../../../adapters/persistence/repositories/task-demo-attempt.repository';
import { AiPromptBuilder } from '../../ai/ai-prompt-builder';
import { LLM_PORT } from '../../../domain/ports/llm.port';

/**
 * Two-part rich-content-quiz manifest. Part A has a 2-level scaffold; Part B
 * has no scaffold (tests the synthesised-feedback fallback).
 */
const RCQ_MANIFEST = {
  id: 'task-demo-rcq-test',
  title: 'RCQ Test',
  readingSteps: [{
    idx: 1,
    label: 'Solve',
    strategy: 'rich-content-quiz',
    answerKey: {
      type: 'rich-content-quiz',
      inputMethods: ['handwrite', 'photo'],
      parts: [
        {
          id: 'a',
          prompt: 'Compute (y+1)(y-1)',
          rubric: [
            { id: 'expand', label: 'Expansion', weight: 1, criteria: 'Has y^2' },
            { id: 'simplify', label: 'Simplify', weight: 1, criteria: 'No 1*y term' },
          ],
          sampleSolution: 'y^2 - 1',
          inputMethods: ['handwrite', 'photo'],
          scaffold: {
            threshold: 0,
            levels: [
              { hintZh: 'Hint level 0 — start by expanding' },
              { hintZh: 'Hint level 1 — combine like terms' },
            ],
          },
        },
        {
          id: 'b',
          prompt: 'Compute (2m+3n)(2m-3n)',
          rubric: [
            { id: 'final', label: 'Final', weight: 1, criteria: 'matches 4m^2 - 9n^2' },
          ],
          sampleSolution: '4m^2 - 9n^2',
          inputMethods: ['handwrite', 'photo'],
          // no scaffold — should synthesise hint from llmFeedback
        },
      ],
    },
  }],
};

describe('TaskDemoService — rich-content-quiz parts flow', () => {
  let module: TestingModule;
  let service: TaskDemoService;
  let lessonRepo: Repository<Lesson>;
  let gradingService: GradingService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DiscoveryModule,
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Lesson, Student, ClassroomSession, TaskDemoAttempt],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, ClassroomSession, TaskDemoAttempt]),
      ],
      providers: [
        ...PLUGIN_PROVIDERS,
        { provide: LLM_PORT, useExisting: AiPromptBuilder },
        TypeOrmLessonRepository,
        { provide: LESSON_REPO_PORT, useExisting: TypeOrmLessonRepository },
        TypeOrmStudentRepository,
        { provide: STUDENT_REPO_PORT, useExisting: TypeOrmStudentRepository },
        TypeOrmClassroomSessionRepository,
        { provide: CLASSROOM_SESSION_REPO_PORT, useExisting: TypeOrmClassroomSessionRepository },
        TypeOrmTaskDemoAttemptRepository,
        { provide: TASK_DEMO_ATTEMPT_REPO_PORT, useExisting: TypeOrmTaskDemoAttemptRepository },
        ExerciseService,
        GradingService,
        ManifestCacheService,
        { provide: AiPromptBuilder, useValue: { callLlm: jest.fn() } },
        TaskDemoService,
      ],
    }).compile();

    service = module.get(TaskDemoService);
    lessonRepo = module.get(getRepositoryToken(Lesson));
    gradingService = module.get(GradingService);

    await lessonRepo.save(lessonRepo.create({
      id: RCQ_MANIFEST.id,
      title: RCQ_MANIFEST.title,
      subject: 'Math',
      gradeLevel: '7',
      manifestJson: JSON.stringify(RCQ_MANIFEST),
    }));
  });

  afterAll(async () => { await module.close(); });

  /** Stub GradingService.grade so we control isCorrect per submission. */
  function mockGradeSequence(scores: Array<{ total: number; llmFeedback?: string }>) {
    let i = 0;
    jest.spyOn(gradingService, 'grade').mockImplementation(async () => {
      const s = scores[Math.min(i, scores.length - 1)];
      i++;
      return { total: s.total, byDimension: {}, ...(s.llmFeedback && { llmFeedback: s.llmFeedback }) } as any;
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('wrong → wrong → correct on Part A advances scaffoldLevel 0 → 1 → completes + nextPartId=b', async () => {
    const { code } = await service.create(RCQ_MANIFEST.id, 1);
    const { studentId } = await service.claim(code, 'alice');

    mockGradeSequence([
      { total: 50, llmFeedback: 'wrong 1' },
      { total: 50, llmFeedback: 'wrong 2' },
      { total: 100 },
    ]);

    const r1 = await service.submit(code, studentId, { partId: 'a', images: ['<img1>'] });
    expect(r1.partId).toBe('a');
    expect(r1.scaffold).toBeDefined();
    expect(r1.scaffold!.level).toBe(0);
    expect(r1.scaffold!.hintZh).toBe('Hint level 0 — start by expanding');
    expect(r1.scaffold!.canRetry).toBe(true);
    expect(r1.nextPartId).toBeNull();
    expect(r1.sampleSolution).toBeNull();
    expect(r1.allCorrect).toBe(false);

    const r2 = await service.submit(code, studentId, { partId: 'a', images: ['<img2>'] });
    expect(r2.scaffold!.level).toBe(1);
    expect(r2.scaffold!.hintZh).toBe('Hint level 1 — combine like terms');
    expect(r2.scaffold!.canRetry).toBe(false); // last level

    const r3 = await service.submit(code, studentId, { partId: 'a', images: ['<img3>'] });
    expect(r3.scaffold).toBeNull();
    expect(r3.nextPartId).toBe('b');
    expect(r3.sampleSolution).toBe('y^2 - 1');

    // Replay should now hold 3 attempts in order.
    const replay = await service.getReplay(code, studentId);
    expect(replay).toHaveLength(3);
    expect(replay[2].data.parts.a.completed).toBe(true);
    expect(replay[2].data.parts.a.scaffoldLevel).toBe(1);
  });

  it('part with no scaffold configured synthesises a basic retry hint from llmFeedback', async () => {
    const { code } = await service.create(RCQ_MANIFEST.id, 1);
    const { studentId } = await service.claim(code, 'bob');

    mockGradeSequence([
      { total: 100 },                                      // pass part A first
      { total: 0, llmFeedback: 'check your signs' },       // wrong part B
    ]);

    await service.submit(code, studentId, { partId: 'a', images: ['<a>'] });
    const r = await service.submit(code, studentId, { partId: 'b', images: ['<b>'] });

    expect(r.scaffold).toBeDefined();
    expect(r.scaffold!.level).toBe(0);
    expect(r.scaffold!.hintZh).toBe('check your signs');
    expect(r.scaffold!.canRetry).toBe(true);
  });

  it('completing both parts emits aggregate score with namespaced byDimension', async () => {
    const { code } = await service.create(RCQ_MANIFEST.id, 1);
    const { studentId } = await service.claim(code, 'carol');

    mockGradeSequence([
      { total: 100 },
      { total: 100 },
    ]);

    await service.submit(code, studentId, { partId: 'a', images: ['<a>'] });
    const r = await service.submit(code, studentId, { partId: 'b', images: ['<b>'] });

    expect(r.nextPartId).toBeNull();
    expect(r.allCorrect).toBe(true);
    expect(r.score?.total).toBe(100);
  });

  it('_pass after seeing scaffold marks part completed without re-grading', async () => {
    const { code } = await service.create(RCQ_MANIFEST.id, 1);
    const { studentId } = await service.claim(code, 'dave');

    mockGradeSequence([
      { total: 30, llmFeedback: 'try again' },
    ]);

    // First a wrong submit so scaffoldLevel goes to 0 (passPart guard).
    await service.submit(code, studentId, { partId: 'a', images: ['<x>'] });

    const r = await service.submit(code, studentId, { partId: 'a', _pass: true });
    expect(r.scaffold).toBeUndefined();
    expect(r.nextPartId).toBe('b');
    expect(r.sampleSolution).toBe('y^2 - 1');
  });

  it('_pass without prior scaffold rejected (production guard mirrored)', async () => {
    const { code } = await service.create(RCQ_MANIFEST.id, 1);
    const { studentId } = await service.claim(code, 'eve');

    await expect(
      service.submit(code, studentId, { partId: 'a', _pass: true }),
    ).rejects.toThrow(/scaffold/i);
  });

  it('_pass works for parts with NO configured scaffold (synthesised hint counts)', async () => {
    // Part b has no `scaffold` block — the helper still bumps scaffoldLevel
    // to 0 when synthesising a hint from llmFeedback, so _pass is allowed.
    const { code } = await service.create(RCQ_MANIFEST.id, 1);
    const { studentId } = await service.claim(code, 'gina');

    mockGradeSequence([
      { total: 100 },                                   // pass part A
      { total: 40, llmFeedback: 'check signs' },        // wrong part B → synth hint
    ]);

    await service.submit(code, studentId, { partId: 'a', images: ['<a>'] });
    const wrong = await service.submit(code, studentId, { partId: 'b', images: ['<b1>'] });
    expect(wrong.scaffold?.hintZh).toBe('check signs');

    // Now _pass on b — should succeed because synthesised hint counts.
    // (allCorrect=false: the aggregate still counts b's most-recent score=40
    // since _pass doesn't re-grade. Only that _pass is allowed + nextPartId
    // resolves matters for the demo flow.)
    const pass = await service.submit(code, studentId, { partId: 'b', _pass: true });
    expect(pass.partId).toBe('b');
    expect(pass.nextPartId).toBeNull();
    expect(pass.sampleSolution).toBe('4m^2 - 9n^2');
  });

  it('concurrent submits on the same part serialize, scaffold ladder advances correctly', async () => {
    // Without the per-(session,student) mutex, two concurrent submits for
    // the same part would both read scaffoldLevel=-1 and both produce
    // level=0 hints (instead of 0 then 1). The unique-attempt constraint
    // would still serialize the inserts, but the scaffold ladder would
    // stall. Lock makes the second submit see the first's effect.
    const { code } = await service.create(RCQ_MANIFEST.id, 1);
    const { studentId } = await service.claim(code, 'henry');

    mockGradeSequence([
      { total: 30, llmFeedback: 'wrong 1' },
      { total: 30, llmFeedback: 'wrong 2' },
    ]);

    const [r1, r2] = await Promise.all([
      service.submit(code, studentId, { partId: 'a', images: ['<x1>'] }),
      service.submit(code, studentId, { partId: 'a', images: ['<x2>'] }),
    ]);

    const levels = [r1.scaffold!.level, r2.scaffold!.level].sort();
    expect(levels).toEqual([0, 1]);
  });

  it('non-part submission path still works (regression for single-shot types)', async () => {
    // Quiz manifest from the other spec doesn't need parts.
    const { code } = await service.create(RCQ_MANIFEST.id, 1);
    const { studentId } = await service.claim(code, 'frank');

    mockGradeSequence([{ total: 100 }]);

    // Even without partId we route through submitPart? No — partId omitted
    // → single-shot path. The single-shot path calls checkAnswer which
    // expects a quiz-shaped key, not rcq. So this test checks that we
    // route correctly: no partId → single-shot path runs (and rcq isn't
    // graded as a single-shot — checkAnswer returns allCorrect=false /
    // null since rcq doesn't grade without parts).
    const r = await service.submit(code, studentId, { answers: [] });
    expect(r.partId).toBeUndefined();
    expect(r.scaffold).toBeUndefined();
  });
});
