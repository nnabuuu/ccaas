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

// Minimal one-step quiz manifest for the grading roundtrip.
const QUIZ_MANIFEST = {
  id: 'task-demo-test-quiz',
  title: 'Quiz',
  readingSteps: [{
    idx: 1,
    label: 'Q1',
    strategy: 'quiz',
    answerKey: {
      type: 'quiz',
      answers: [
        {
          questionIdx: 0,
          questionText: 'Pick 1',
          options: ['A', 'B', 'C', 'D'],
          correct: 1,
        },
        {
          questionIdx: 1,
          questionText: 'Pick 2',
          options: ['A', 'B', 'C', 'D'],
          correct: 2,
        },
      ],
    },
  }],
};

describe('TaskDemoService', () => {
  let module: TestingModule;
  let service: TaskDemoService;
  let lessonRepo: Repository<Lesson>;

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

    await lessonRepo.save(lessonRepo.create({
      id: QUIZ_MANIFEST.id,
      title: QUIZ_MANIFEST.title,
      subject: 'English',
      gradeLevel: '7',
      manifestJson: JSON.stringify(QUIZ_MANIFEST),
    }));
  });

  afterAll(async () => { await module.close(); });

  describe('create', () => {
    it('returns a 6-char code and stores step on currentStep', async () => {
      const out = await service.create(QUIZ_MANIFEST.id, 1);
      expect(out.code).toMatch(/^[A-Z2-9]{6}$/);
      expect(out.lessonId).toBe(QUIZ_MANIFEST.id);
      expect(out.step).toBe(1);

      // /exercise resolves via session.currentStep — round-trip confirms it.
      const spec = await service.getExerciseSpec(out.code);
      expect(spec.step).toBe(1);
      expect((spec as any).type).toBe('quiz');
    });
  });

  describe('claim', () => {
    it('is idempotent: re-claim with same name returns same studentId', async () => {
      const { code } = await service.create(QUIZ_MANIFEST.id, 1);
      const first = await service.claim(code, 'alice');
      const second = await service.claim(code, 'alice');
      expect(second.studentId).toBe(first.studentId);
    });

    it('normalizes name (trim + lowercase)', async () => {
      const { code } = await service.create(QUIZ_MANIFEST.id, 1);
      const a = await service.claim(code, 'Alice');
      const b = await service.claim(code, '  alice  ');
      const c = await service.claim(code, 'ALICE');
      expect(b.studentId).toBe(a.studentId);
      expect(c.studentId).toBe(a.studentId);
    });

    it('different names produce different students', async () => {
      const { code } = await service.create(QUIZ_MANIFEST.id, 1);
      const a = await service.claim(code, 'alice');
      const b = await service.claim(code, 'bob');
      expect(a.studentId).not.toBe(b.studentId);
    });
  });

  describe('exercise spec is sanitized', () => {
    it('strips correct/hint/walkthrough from quiz answers', async () => {
      const { code } = await service.create(QUIZ_MANIFEST.id, 1);
      const spec: any = await service.getExerciseSpec(code);
      // Quiz spec contract: keeps questions[].{idx, text?, options}, drops correct/hint/walkthrough.
      const qs = spec.questions ?? spec.quizQuestions ?? [];
      expect(qs.length).toBeGreaterThan(0);
      for (const q of qs) {
        expect(q.correct).toBeUndefined();
        expect(q.hint).toBeUndefined();
        expect(q.walkthrough).toBeUndefined();
      }
    });
  });

  describe('submit', () => {
    it('attempt numbers start at 1 and increment monotonically', async () => {
      const { code } = await service.create(QUIZ_MANIFEST.id, 1);
      const { studentId } = await service.claim(code, 'alice');
      const r1 = await service.submit(code, studentId, { answers: [1, 2] });
      const r2 = await service.submit(code, studentId, { answers: [0, 2] });
      const r3 = await service.submit(code, studentId, { answers: [1, 2] });
      expect(r1.attempt).toBe(1);
      expect(r2.attempt).toBe(2);
      expect(r3.attempt).toBe(3);
      expect(r1.allCorrect).toBe(true);
      expect(r2.allCorrect).toBe(false);
      expect(r3.allCorrect).toBe(true);
    });

    it('per-student attempt counters are independent', async () => {
      const { code } = await service.create(QUIZ_MANIFEST.id, 1);
      const a = await service.claim(code, 'alice');
      const b = await service.claim(code, 'bob');
      await service.submit(code, a.studentId, { answers: [1, 2] });
      const b1 = await service.submit(code, b.studentId, { answers: [0, 0] });
      expect(b1.attempt).toBe(1);
    });

    it('rejects unknown studentId', async () => {
      const { code } = await service.create(QUIZ_MANIFEST.id, 1);
      await expect(
        service.submit(code, '00000000-0000-0000-0000-000000000000', { answers: [1, 2] }),
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('listRespondents + getReplay', () => {
    it('lists all respondents with attempt counts + replay returns ordered history', async () => {
      const { code } = await service.create(QUIZ_MANIFEST.id, 1);
      const a = await service.claim(code, 'alice');
      const b = await service.claim(code, 'bob');
      await service.submit(code, a.studentId, { answers: [0, 0] });
      await service.submit(code, a.studentId, { answers: [1, 2] });
      await service.submit(code, b.studentId, { answers: [1, 2] });

      const respondents = await service.listRespondents(code);
      const byName = Object.fromEntries(respondents.map(r => [r.name, r]));
      expect(byName['alice']?.attemptCount).toBe(2);
      expect(byName['bob']?.attemptCount).toBe(1);

      const replay = await service.getReplay(code, a.studentId);
      expect(replay).toHaveLength(2);
      expect(replay[0].attempt).toBe(1);
      expect(replay[1].attempt).toBe(2);
      expect(replay[0].data).toEqual({ answers: [0, 0] });
      expect(replay[1].data).toEqual({ answers: [1, 2] });
    });
  });
});
