import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ClassroomService } from './classroom.service';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import { ObservationEvent } from '../entities/observation-event.entity';
import { Lesson } from '../entities/lesson.entity';
import { ObservationService } from './observation.service';
import { GradingService } from './grading.service';
import { AiPromptBuilder } from './ai-prompt-builder';
import { MetricsAggregator } from './metrics-aggregator';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OBSERVER_ENGINE } from '@kedge-agentic/observer-engine';

const mockObserverEngine = {
  dispatch: jest.fn().mockResolvedValue(undefined),
  setSessionMeta: jest.fn(),
  clearSessionMeta: jest.fn(),
  register: jest.fn(),
};

// Minimal manifest with one quiz step for grading tests
const TEST_MANIFEST = {
  id: 'test-lesson',
  title: 'Test Lesson',
  readingSteps: [
    {
      idx: 1,
      label: 'Quiz Step',
      strategy: 'quiz',
      answerKey: {
        type: 'quiz',
        answers: [
          { questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] },
          { questionIdx: 1, correct: 0, questionText: 'Q2', options: ['A', 'B'] },
        ],
      },
    },
  ],
};

// Full manifest covering all 5 task steps with different grading types
const FULL_MANIFEST = {
  id: 'full-lesson',
  title: 'Full Test Lesson',
  readingSteps: [
    {
      idx: 1,
      label: 'Quiz Step',
      strategy: 'quiz',
      answerKey: {
        type: 'quiz',
        answers: [
          { questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] },
          { questionIdx: 1, correct: 0, questionText: 'Q2', options: ['A', 'B'] },
        ],
      },
    },
    {
      idx: 3,
      label: 'Match Step',
      strategy: 'match',
      answerKey: {
        type: 'match',
        options: ['skimming', 'scanning', 'inferring'],
        answers: [
          { pairIdx: 0, left: 'Skim', correct: 'skimming' },
          { pairIdx: 1, left: 'Scan', correct: 'scanning' },
          { pairIdx: 2, left: 'Infer', correct: 'inferring' },
        ],
      },
    },
    {
      idx: 5,
      label: 'Matrix Step',
      strategy: 'matrix',
      answerKey: {
        type: 'matrix',
        answers: [
          { rowIdx: 0, place: 'Japan', practice: 'meditation', reason: 'focus', isDemo: false },
          { rowIdx: 1, place: 'India', practice: 'yoga', reason: 'flexibility', isDemo: false },
        ],
      },
    },
    {
      idx: 7,
      label: 'Stance Step',
      strategy: 'stance',
      answerKey: {
        type: 'stance',
        validPositions: ['agree', 'disagree'],
        minEvidence: 2,
        stanceOpts: ['agree', 'disagree'],
        evidence: ['e1', 'e2'],
      },
    },
    {
      idx: 9,
      label: 'Order Step',
      strategy: 'order',
      answerKey: {
        type: 'order',
        items: ['Introduction', 'Body', 'Conclusion'],
        correctOrder: [0, 1, 2],
      },
    },
  ],
};

// Manifest for checkAnswer / buildCheckItems tests
const CHECK_MANIFEST = {
  id: 'check-lesson',
  title: 'Check Lesson',
  readingSteps: [
    {
      idx: 1,
      label: 'Order Step',
      strategy: 'order',
      answerKey: {
        type: 'order',
        items: ['Introduction', 'Body', 'Conclusion'],
        correctOrder: [0, 1, 2],
      },
    },
    {
      idx: 3,
      label: 'Map Step',
      strategy: 'map',
      answerKey: {
        type: 'map',
        prompt: 'Place items on the map',
        axes: {
          x: { neg: 'Low', pos: 'High', label: 'Importance' },
          y: { neg: 'Old', pos: 'New', label: 'Time' },
        },
        items: [
          { id: 'itemA', label: 'Item A' },
          { id: 'itemB', label: 'Item B' },
        ],
        expected: { itemA: [0.5, 0.5], itemB: [-0.5, -0.5] },
        minReasonLength: 3,
      },
    },
  ],
};

// Manifest with a step that has no answerKey (but still a task)
const NO_KEY_MANIFEST = {
  id: 'no-key-lesson',
  title: 'No Key Lesson',
  readingSteps: [
    { idx: 1, type: 'task', label: 'Reading step', strategy: 'read' },
  ],
};

/** Advance a student to the given task by submitting all prior task steps. */
async function advanceToTask(
  svc: ClassroomService,
  session: ClassroomSession,
  studentId: string,
  targetTask: number,
) {
  const steps = [
    { step: 1, data: { answers: [1, 0] } },
    { step: 3, data: { pairs: ['skimming', 'scanning', 'inferring'] } },
    { step: 5, data: { rows: [
      { place: 'Japan', practice: 'meditation', reason: 'focus' },
      { place: 'India', practice: 'yoga', reason: 'flexibility' },
    ] } },
    { step: 7, data: { position: 'agree', evidence: ['e1', 'e2'] } },
    { step: 9, data: { order: ['Introduction', 'Body', 'Conclusion'] } },
  ];
  for (let i = 0; i < targetTask - 1 && i < steps.length; i++) {
    await svc.submit(session, studentId, steps[i].step, steps[i].data);
  }
}

describe('ClassroomService — persistence', () => {
  let module: TestingModule;
  let service: ClassroomService;
  let sessionRepo: Repository<ClassroomSession>;
  let studentRepo: Repository<Student>;
  let submissionRepo: Repository<Submission>;
  let aiQuestionRepo: Repository<AiQuestion>;
  let lessonRepo: Repository<Lesson>;

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
      providers: [
        ClassroomService, ObservationService, GradingService, AiPromptBuilder, MetricsAggregator,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    service = module.get(ClassroomService);
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    studentRepo = module.get(getRepositoryToken(Student));
    submissionRepo = module.get(getRepositoryToken(Submission));
    aiQuestionRepo = module.get(getRepositoryToken(AiQuestion));
    lessonRepo = module.get(getRepositoryToken(Lesson));

    // Seed test lesson
    await lessonRepo.save(
      lessonRepo.create({
        id: 'test-lesson',
        title: 'Test Lesson',
        subject: 'English',
        gradeLevel: '7',
        manifestJson: JSON.stringify(TEST_MANIFEST),
      }),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  it('should create a session and persist it', async () => {
    const result = await service.createSession('test-lesson');
    expect(result.sessionId).toBeDefined();
    expect(result.code).toHaveLength(6);
    expect(result.status).toBe('waiting');

    const dbSession = await sessionRepo.findOne({ where: { id: result.sessionId } });
    expect(dbSession).not.toBeNull();
    expect(dbSession!.currentStep).toBe(0);
  });

  // Tests in this block run sequentially and build on each other's state.
  // This is intentional — it mirrors a real session lifecycle.
  describe('with a session and student', () => {
    let session: ClassroomSession;
    let studentId: string;

    beforeAll(async () => {
      const created = await service.createSession('test-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });

      const joined = await service.join(session!, '测试学生');
      studentId = joined.studentId;
    });

    it('should persist student with default progress and return in getState', async () => {
      const student = await studentRepo.findOne({ where: { id: studentId } });
      expect(student).not.toBeNull();
      expect(student!.currentTask).toBe(1);
      expect(student!.currentPhase).toBe('listen');

      const state = await service.getState(session.id);
      const s = state.students.find(s => s.id === studentId);
      expect(s).toBeDefined();
      expect(s!.currentTask).toBe(1);
      expect(s!.currentPhase).toBe('listen');
    });

    it('should persist score, advance progress, and reflect in getState after submit', async () => {
      // Submit and verify score
      const result = await service.submit(session, studentId, 1, {
        answers: [1, 0],
      });
      expect(result.ok).toBe(true);
      expect(result.score).toBeDefined();
      expect(result.score.total).toBe(100);

      // Verify score persisted in DB
      const sub = await submissionRepo.findOne({
        where: { sessionId: session.id, studentId, step: 1 },
      });
      expect(sub).not.toBeNull();
      expect(sub!.scoreJson).toEqual({ total: 100, byDimension: { q0: true, q1: true } });

      // Verify progress: test-lesson has only 1 task, so completing it → completed
      const student = await studentRepo.findOne({ where: { id: studentId } });
      expect(student!.currentTask).toBe(1);
      expect(student!.currentPhase).toBe('completed');

      // Verify score visible in getState
      const state = await service.getState(session.id);
      const s = state.students.find(s => s.id === studentId);
      expect(s!.submissions[1]).toBeDefined();
      expect(s!.submissions[1].score).toEqual({ total: 100, byDimension: { q0: true, q1: true } });
    });

    it('should persist and use currentStep via setStep', async () => {
      await service.setStep(session.id, 3);

      const dbSession = await sessionRepo.findOne({ where: { id: session.id } });
      expect(dbSession!.currentStep).toBe(3);

      const state = await service.getState(session.id);
      expect(state.currentStep).toBe(3);
    });

    it('should persist AI questions in DB', async () => {
      // Directly insert an AiQuestion to test DB persistence
      // (actual aiAsk calls the GLM API which we can't test without mocking)
      const q = aiQuestionRepo.create({
        sessionId: session.id,
        studentId,
        studentName: '测试学生',
        step: 1,
        question: '什么是skimming？',
        answer: 'Skimming是快速浏览文章获取大意的阅读策略。',
        category: '概念理解',
      });
      await aiQuestionRepo.save(q);

      const state = await service.getState(session.id);
      expect(state.questions.length).toBe(1);
      expect(state.questions[0].question).toBe('什么是skimming？');
      expect(state.questions[0].category).toBe('概念理解');
      expect(state.questions[0].studentName).toBe('测试学生');
    });

    it('should compute stepMetrics from persisted data', async () => {
      const state = await service.getState(session.id);
      // Task 1 (step idx 1) was submitted with score 100
      expect(state.stepMetrics[1].completedCount).toBe(1);
      expect(state.stepMetrics[1].avgScore).toBe(100);
      // test-lesson has only 1 task, so no stepMetrics[2]
      expect(state.stepMetrics[2]).toBeUndefined();
    });

    it('should handle re-join returning existing student with persisted progress', async () => {
      const rejoined = await service.join(session, '测试学生');
      expect(rejoined.studentId).toBe(studentId);

      // Progress should still reflect completed state (test-lesson has 1 task)
      const student = await studentRepo.findOne({ where: { id: studentId } });
      expect(student!.currentTask).toBe(1);
      expect(student!.currentPhase).toBe('completed');
    });

    it('should handle re-submit updating score', async () => {
      // Submit again with wrong answers
      const result = await service.submit(session, studentId, 1, {
        answers: [0, 1],
      });
      expect(result.score.total).toBe(0);

      const sub = await submissionRepo.findOne({
        where: { sessionId: session.id, studentId, step: 1 },
      });
      expect(sub!.scoreJson).toEqual({ total: 0, byDimension: { q0: false, q1: false } });
    });
  });

  describe('endSession', () => {
    it('should mark session as ended', async () => {
      const created = await service.createSession('test-lesson');
      const session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      await service.join(session!, '学生A');

      const result = await service.endSession(created.code);
      expect(result.status).toBe('ended');

      const dbSession = await sessionRepo.findOne({ where: { id: created.sessionId } });
      expect(dbSession!.status).toBe('ended');
      expect(dbSession!.endedAt).not.toBeNull();
    });

    it('should preserve student and submission data after endSession', async () => {
      const created = await service.createSession('test-lesson');
      const session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const joined = await service.join(session!, '学生B');
      await service.submit(session!, joined.studentId, 1, { answers: [1, 0] });

      await service.endSession(created.code);

      // Data should still be in DB for post-class review
      const state = await service.getState(created.sessionId);
      expect(state.students.length).toBe(1);
      expect(state.students[0].submissions[1]).toBeDefined();
      expect(state.students[0].submissions[1].score.total).toBe(100);
    });
  });
});

// ════════════════════════════════════════════════════════════════
// New test suites below
// ════════════════════════════════════════════════════════════════

describe('ClassroomService — extended coverage', () => {
  let module: TestingModule;
  let service: ClassroomService;
  let aiPromptBuilder: AiPromptBuilder;
  let sessionRepo: Repository<ClassroomSession>;
  let studentRepo: Repository<Student>;
  let submissionRepo: Repository<Submission>;
  let aiQuestionRepo: Repository<AiQuestion>;
  let lessonRepo: Repository<Lesson>;

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
      providers: [
        ClassroomService, ObservationService, GradingService, AiPromptBuilder, MetricsAggregator,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    service = module.get(ClassroomService);
    aiPromptBuilder = module.get(AiPromptBuilder);
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    studentRepo = module.get(getRepositoryToken(Student));
    submissionRepo = module.get(getRepositoryToken(Submission));
    aiQuestionRepo = module.get(getRepositoryToken(AiQuestion));
    lessonRepo = module.get(getRepositoryToken(Lesson));

    // Seed lessons
    await lessonRepo.save([
      lessonRepo.create({
        id: 'full-lesson',
        title: 'Full Test Lesson',
        subject: 'English',
        gradeLevel: '7',
        manifestJson: JSON.stringify(FULL_MANIFEST),
      }),
      lessonRepo.create({
        id: 'no-key-lesson',
        title: 'No Key Lesson',
        subject: 'English',
        gradeLevel: '7',
        manifestJson: JSON.stringify(NO_KEY_MANIFEST),
      }),
      lessonRepo.create({
        id: 'check-lesson',
        title: 'Check Lesson',
        subject: 'English',
        gradeLevel: '7',
        manifestJson: JSON.stringify(CHECK_MANIFEST),
      }),
    ]);
  });

  afterAll(async () => {
    await module.close();
  });

  // ── Teacher dashboard — multi-student (#1, #2) ──

  describe('teacher dashboard — multi-student', () => {
    let session: ClassroomSession;
    let idA: string, idB: string, idC: string;

    beforeAll(async () => {
      const created = await service.createSession('full-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });

      idA = (await service.join(session, '学生A')).studentId;
      idB = (await service.join(session, '学生B')).studentId;
      idC = (await service.join(session, '学生C')).studentId;

      // A submits step 1 (task 1) → advances to task 2
      await service.submit(session, idA, 1, { answers: [1, 0] });

      // B submits step 1 (task 1) → task 2, then step 3 (task 2) → task 3
      await service.submit(session, idB, 1, { answers: [1, 0] });
      await service.submit(session, idB, 3, {
        pairs: ['skimming', 'scanning', 'inferring'],
      });

      // C does nothing → stays at task 1
    });

    it('should show correct stepMetrics for multi-student scenario', async () => {
      const state = await service.getState(session.id);

      // 3 total students
      expect(state.metrics.total).toBe(3);

      // Task 1 (step 1): A + B completed, C has not
      expect(state.stepMetrics[1].completedCount).toBe(2);
      // C is currentTask=1, not submitted → currentCount=1
      expect(state.stepMetrics[1].currentCount).toBe(1);

      // Task 2 (step 3): B completed, A is currentTask=2 not submitted
      expect(state.stepMetrics[2].completedCount).toBe(1);
      expect(state.stepMetrics[2].currentCount).toBe(1); // A at task 2

      // Task 3 (step 5): nobody completed, B is at task 3
      expect(state.stepMetrics[3].completedCount).toBe(0);
      expect(state.stepMetrics[3].currentCount).toBe(1); // B at task 3
    });

    it('should track metrics.submitted following teacher currentStep', async () => {
      // Teacher sets currentStep=1 → A and B submitted step 1
      await service.setStep(session.id, 1);
      const state1 = await service.getState(session.id);
      expect(state1.metrics.submitted).toBe(2);
      expect(state1.metrics.inProgress).toBe(1);

      // Teacher sets currentStep=3 → only B submitted step 3
      await service.setStep(session.id, 3);
      const state3 = await service.getState(session.id);
      expect(state3.metrics.submitted).toBe(1);
      expect(state3.metrics.inProgress).toBe(2);
    });
  });

  // ── Session isolation (#3) ──

  describe('session isolation', () => {
    it('should isolate students between concurrent sessions', async () => {
      const createdA = await service.createSession('full-lesson');
      const sessA = await sessionRepo.findOne({ where: { id: createdA.sessionId } });
      const createdB = await service.createSession('full-lesson');
      const sessB = await sessionRepo.findOne({ where: { id: createdB.sessionId } });

      await service.join(sessA!, '隔离学生1');
      await service.join(sessA!, '隔离学生2');
      await service.join(sessB!, '隔离学生3');

      const stateA = await service.getState(sessA!.id);
      const stateB = await service.getState(sessB!.id);

      expect(stateA.students.length).toBe(2);
      expect(stateA.students.map(s => s.name).sort()).toEqual(['隔离学生1', '隔离学生2']);
      expect(stateB.students.length).toBe(1);
      expect(stateB.students[0].name).toBe('隔离学生3');
    });
  });

  // ── Progress edge cases (#4, #5, #6) ──

  describe('progress edge cases', () => {
    it('should set currentPhase to completed when all tasks are submitted', async () => {
      const created = await service.createSession('full-lesson');
      const session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const joined = await service.join(session!, '完成学生');
      const sid = joined.studentId;

      // Submit all 6 tasks in order
      await service.submit(session!, sid, 1, { answers: [1, 0] }); // task 1→2
      await service.submit(session!, sid, 3, { pairs: ['skimming', 'scanning', 'inferring'] }); // task 2→3
      await service.submit(session!, sid, 5, {
        rows: [
          { place: 'Japan', practice: 'meditation', reason: 'focus' },
          { place: 'India', practice: 'yoga', reason: 'flexibility' },
        ],
      }); // task 3→4
      await service.submit(session!, sid, 7, { position: 'agree', evidence: ['e1', 'e2'] }); // task 4→5
      await service.submit(session!, sid, 9, {
        order: ['Introduction', 'Body', 'Conclusion'],
      }); // task 5 → completed

      const student = await studentRepo.findOne({ where: { id: sid } });
      expect(student!.currentPhase).toBe('completed');
      expect(student!.currentTask).toBe(5);
    });

    it('should save submission but not change progress for non-task steps', async () => {
      const created = await service.createSession('full-lesson');
      const session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const joined = await service.join(session!, '非任务学生');
      const sid = joined.studentId;

      // Step 2 is not in STEP_TO_TASK mapping
      await service.submit(session!, sid, 2, { note: 'some reading notes' });

      // Submission saved
      const sub = await submissionRepo.findOne({
        where: { sessionId: session!.id, studentId: sid, step: 2 },
      });
      expect(sub).not.toBeNull();
      expect(sub!.scoreJson).toBeNull(); // no answerKey for step 2

      // Progress unchanged
      const student = await studentRepo.findOne({ where: { id: sid } });
      expect(student!.currentTask).toBe(1);
      expect(student!.currentPhase).toBe('listen');
    });

    it('should not regress student progress when re-submitting an earlier step', async () => {
      const created = await service.createSession('full-lesson');
      const session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const joined = await service.join(session!, '超前学生');
      const sid = joined.studentId;

      // Advance to task 3
      await service.submit(session!, sid, 1, { answers: [1, 0] }); // task 1→2
      await service.submit(session!, sid, 3, { pairs: ['skimming', 'scanning', 'inferring'] }); // task 2→3

      let student = await studentRepo.findOne({ where: { id: sid } });
      expect(student!.currentTask).toBe(3);

      // Re-submit step 1 (task 1) — should NOT regress to task 2
      await service.submit(session!, sid, 1, { answers: [0, 1] });

      student = await studentRepo.findOne({ where: { id: sid } });
      expect(student!.currentTask).toBe(3);
    });
  });

  // ── Notification toggle (#7) ──

  describe('notification toggle', () => {
    it('should toggle notifications and manage different messages independently', async () => {
      const created = await service.createSession('full-lesson');
      const sessionId = created.sessionId;

      // Activate on first call
      const r1 = service.notify(sessionId, '请注意听讲', 'attention');
      expect(r1.ok).toBe(true);
      expect(r1.active).toBe(true);

      // Revoke same notification on second call
      const r2 = service.notify(sessionId, '请注意听讲', 'attention');
      expect(r2.ok).toBe(true);
      expect(r2.active).toBe(false);

      // Re-activate on third call
      const r3 = service.notify(sessionId, '请注意听讲', 'attention');
      expect(r3.active).toBe(true);

      // Different messages are independent
      const r4 = service.notify(sessionId, '请翻到第3页', 'instruction');
      expect(r4.active).toBe(true);

      // Revoke '请注意听讲' without affecting '请翻到第3页'
      const r5 = service.notify(sessionId, '请注意听讲', 'attention');
      expect(r5.active).toBe(false);

      // '请翻到第3页' still active — re-toggling it should revoke
      const r6 = service.notify(sessionId, '请翻到第3页', 'instruction');
      expect(r6.active).toBe(false);
    });
  });

  // ── aiAsk (#8, #9, #10) ──

  describe('aiAsk', () => {
    let session: ClassroomSession;
    let studentId: string;

    beforeAll(async () => {
      const created = await service.createSession('full-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      studentId = (await service.join(session, 'AI学生')).studentId;
    });

    afterEach(() => jest.restoreAllMocks());

    it('should complete full aiAsk flow with mocked callGlm', async () => {
      jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValueOnce(
        '【概念理解】Skimming是一种快速阅读策略，帮助你抓住文章大意。',
      );

      const result = await service.aiAsk(session, studentId, 1, '什么是skimming？');

      expect(result.category).toBe('概念理解');
      expect(result.answer).toBe('Skimming是一种快速阅读策略，帮助你抓住文章大意。');

      // Verify persisted in DB
      const questions = await aiQuestionRepo.find({
        where: { sessionId: session.id, studentId },
      });
      expect(questions.length).toBe(1);
      expect(questions[0].question).toBe('什么是skimming？');
      expect(questions[0].category).toBe('概念理解');

      // Verify visible in getState
      const state = await service.getState(session.id);
      const q = state.questions.find(q => q.studentId === studentId);
      expect(q).toBeDefined();
      expect(q!.category).toBe('概念理解');
    });

    it('should fallback gracefully when callGlm throws', async () => {
      jest.spyOn(aiPromptBuilder, 'callGlm').mockRejectedValueOnce(
        new Error('API timeout'),
      );

      const result = await service.aiAsk(session, studentId, 1, '这篇文章讲了什么？');

      expect(result.category).toBe('其他');
      expect(result.answer).toBe('AI 助教暂时无法回答，请稍后再试。');

      // Still persisted
      const questions = await aiQuestionRepo.find({
        where: { sessionId: session.id, studentId },
        order: { id: 'DESC' },
      });
      expect(questions.length).toBe(2); // previous + this one
      const latest = questions[0];
      expect(latest.category).toBe('其他');
      expect(latest.answer).toBe('AI 助教暂时无法回答，请稍后再试。');
    });

    it('should throw NotFoundException for invalid studentId', async () => {
      await expect(
        service.aiAsk(session, 'non-existent-id', 1, '问题'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Session lifecycle errors (#11, #12, #13, #14) ──

  describe('session lifecycle errors', () => {
    it('should throw NotFoundException for invalid session code', async () => {
      await expect(service.resolveSession('XXXXXX')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent UUID', async () => {
      await expect(service.resolveSession('00000000-0000-0000-0000-000000000000')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for ended session via resolveActiveSession', async () => {
      const created = await service.createSession('full-lesson');
      await service.endSession(created.code);

      await expect(service.resolveActiveSession(created.code)).rejects.toThrow(BadRequestException);
    });

    it('should be idempotent when ending a session twice', async () => {
      const created = await service.createSession('full-lesson');
      const r1 = await service.endSession(created.code);
      expect(r1.status).toBe('ended');

      const r2 = await service.endSession(created.code);
      expect(r2.status).toBe('ended');
      expect(r2.ok).toBe(true);
    });

    it('should throw NotFoundException when submitting for invalid student', async () => {
      const created = await service.createSession('full-lesson');
      const session = await sessionRepo.findOne({ where: { id: created.sessionId } });

      await expect(
        service.submit(session!, 'non-existent-student', 1, { answers: [1, 0] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return complete session info via getSessionInfo', async () => {
      const created = await service.createSession('full-lesson');
      const info = await service.getSessionInfo(created.code);

      expect(info.sessionId).toBe(created.sessionId);
      expect(info.code).toBe(created.code);
      expect(info.lessonId).toBe('full-lesson');
      expect(info.status).toBe('waiting');
      expect(info.createdAt).toBeDefined();
    });
  });

  describe('resolveSession — UUID support', () => {
    it('should resolve session by UUID (id)', async () => {
      const created = await service.createSession('full-lesson');
      const session = await service.resolveSession(created.sessionId);
      expect(session.id).toBe(created.sessionId);
      expect(session.code).toBe(created.code);
    });

    it('should resolve session by 6-char code', async () => {
      const created = await service.createSession('full-lesson');
      const session = await service.resolveSession(created.code);
      expect(session.id).toBe(created.sessionId);
    });

    it('should return same session for both UUID and code', async () => {
      const created = await service.createSession('full-lesson');
      const byUuid = await service.resolveSession(created.sessionId);
      const byCode = await service.resolveSession(created.code);
      expect(byUuid.id).toBe(byCode.id);
    });

    it('should return session info when looked up by UUID', async () => {
      const created = await service.createSession('full-lesson');
      const info = await service.getSessionInfo(created.sessionId);
      expect(info.sessionId).toBe(created.sessionId);
      expect(info.code).toBe(created.code);
      expect(info.lessonId).toBe('full-lesson');
    });
  });

  // ── batchCheckSessions ──

  describe('batchCheckSessions', () => {
    it('should return empty for empty id list', async () => {
      const result = await service.batchCheckSessions([]);
      expect(result).toEqual([]);
    });

    it('should return matching active/waiting sessions with lesson title', async () => {
      const created = await service.createSession('full-lesson');
      const result = await service.batchCheckSessions([created.sessionId]);
      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe(created.sessionId);
      expect(result[0].code).toBe(created.code);
      expect(result[0].title).toBe('Full Test Lesson');
      expect(result[0].status).toBe('waiting');
    });

    it('should filter by status when provided', async () => {
      const created = await service.createSession('full-lesson');
      // waiting session should not appear with 'active' filter
      const activeOnly = await service.batchCheckSessions([created.sessionId], 'active');
      expect(activeOnly).toEqual([]);

      // start the session → now it's active
      await service.startSession(created.code);
      const afterStart = await service.batchCheckSessions([created.sessionId], 'active');
      expect(afterStart).toHaveLength(1);
      expect(afterStart[0].status).toBe('active');

      // should not appear with 'waiting' filter
      const waitingOnly = await service.batchCheckSessions([created.sessionId], 'waiting');
      expect(waitingOnly).toEqual([]);
    });

    it('should exclude ended sessions', async () => {
      const created = await service.createSession('full-lesson');
      await service.endSession(created.code);
      const result = await service.batchCheckSessions([created.sessionId]);
      expect(result).toEqual([]);
    });

    it('should return empty for non-existent session IDs', async () => {
      const result = await service.batchCheckSessions(['non-existent-id-1', 'non-existent-id-2']);
      expect(result).toEqual([]);
    });
  });

  // ── startSession ──

  describe('startSession', () => {
    it('should transition session from waiting to active', async () => {
      const created = await service.createSession('full-lesson');
      expect(created.status).toBe('waiting');

      const result = await service.startSession(created.code);
      expect(result.ok).toBe(true);
      expect(result.status).toBe('active');
      expect(result.startedAt).toBeDefined();

      const dbSession = await sessionRepo.findOne({ where: { id: created.sessionId } });
      expect(dbSession!.status).toBe('active');
      expect(dbSession!.startedAt).not.toBeNull();
    });

    it('should be idempotent for already active session', async () => {
      const created = await service.createSession('full-lesson');
      await service.startSession(created.code);

      const result = await service.startSession(created.code);
      expect(result.ok).toBe(true);
      expect(result.status).toBe('active');
    });

    it('should throw for ended session', async () => {
      const created = await service.createSession('full-lesson');
      await service.endSession(created.code);

      await expect(service.startSession(created.code)).rejects.toThrow(BadRequestException);
    });
  });

  // ── Grading types (#15, #16, #17, #18) ──

  describe('grading types', () => {
    let session: ClassroomSession;

    beforeAll(async () => {
      const created = await service.createSession('full-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });
    });

    describe('match grading', () => {
      it('should score 100 for all correct pairs', async () => {
        const freshId = (await service.join(session, '匹配全对学生')).studentId;
        await advanceToTask(service, session, freshId, 2);

        const result = await service.submit(session, freshId, 3, {
          pairs: ['skimming', 'scanning', 'inferring'],
        });
        expect(result.score.total).toBe(100);
        expect(result.score.byDimension).toEqual({ p0: true, p1: true, p2: true });
      });

      it('should score partially for some correct pairs', async () => {
        const freshId = (await service.join(session, '匹配部分学生')).studentId;
        await advanceToTask(service, session, freshId, 2);

        const result = await service.submit(session, freshId, 3, {
          pairs: ['skimming', 'wrong', 'inferring'],
        });
        expect(result.score.total).toBe(67); // 2/3 = 66.67 → round to 67
        expect(result.score.byDimension.p0).toBe(true);
        expect(result.score.byDimension.p1).toBe(false);
        expect(result.score.byDimension.p2).toBe(true);
      });

      it('should score 0 for all wrong pairs', async () => {
        const freshId = (await service.join(session, '匹配全错学生')).studentId;
        await advanceToTask(service, session, freshId, 2);

        const result = await service.submit(session, freshId, 3, {
          pairs: ['wrong1', 'wrong2', 'wrong3'],
        });
        expect(result.score.total).toBe(0);
      });
    });

    describe('order grading', () => {
      it('should score 100 for correct order', async () => {
        const freshId = (await service.join(session, '排序学生')).studentId;
        await advanceToTask(service, session, freshId, 5);

        const result = await service.submit(session, freshId, 9, {
          order: ['Introduction', 'Body', 'Conclusion'],
        });
        expect(result.score.total).toBe(100);
        expect(result.score.byDimension.correct).toBe(true);
      });

      it('should score 0 for wrong order', async () => {
        const freshId = (await service.join(session, '排序错误学生')).studentId;
        await advanceToTask(service, session, freshId, 5);

        const result = await service.submit(session, freshId, 9, {
          order: ['Conclusion', 'Body', 'Introduction'],
        });
        expect(result.score.total).toBe(0);
        expect(result.score.byDimension.correct).toBe(false);
      });
    });

    describe('stance grading', () => {
      it('should score 100 for valid position + enough evidence', async () => {
        const freshId = (await service.join(session, '观点学生')).studentId;
        await advanceToTask(service, session, freshId, 4);

        const result = await service.submit(session, freshId, 7, {
          position: 'agree',
          evidence: ['reason1', 'reason2'],
        });
        expect(result.score.total).toBe(100);
        expect(result.score.byDimension.position).toBe(true);
        expect(result.score.byDimension.evidence).toBe(true);
      });

      it('should score 50 for valid position but insufficient evidence', async () => {
        const freshId = (await service.join(session, '证据不足学生')).studentId;
        await advanceToTask(service, session, freshId, 4);

        const result = await service.submit(session, freshId, 7, {
          position: 'agree',
          evidence: ['only_one'],
        });
        expect(result.score.total).toBe(50);
        expect(result.score.byDimension.position).toBe(true);
        expect(result.score.byDimension.evidence).toBe(false);
      });

      it('should score 0 for invalid position and no evidence', async () => {
        const freshId = (await service.join(session, '全错学生')).studentId;
        await advanceToTask(service, session, freshId, 4);

        const result = await service.submit(session, freshId, 7, {
          position: 'neutral', // not in validPositions
          evidence: [],
        });
        expect(result.score.total).toBe(0);
        expect(result.score.byDimension.position).toBe(false);
        expect(result.score.byDimension.evidence).toBe(false);
      });
    });

    describe('quiz attemptCounts passthrough', () => {
      it('should include attemptCounts in score when provided', async () => {
        const freshId = (await service.join(session, 'QuizAttemptStudent')).studentId;

        const result = await service.submit(session, freshId, 1, {
          answers: [1, 0],
          attemptCounts: { 0: 3, 1: 1 },
        });
        expect(result.score.total).toBe(100);
        expect(result.score.attemptCounts).toEqual({ q0: 3, q1: 1 });
      });

      it('should not include attemptCounts when not provided', async () => {
        const freshId = (await service.join(session, 'QuizNoAttempt')).studentId;

        const result = await service.submit(session, freshId, 1, {
          answers: [1, 0],
        });
        expect(result.score.total).toBe(100);
        expect(result.score.attemptCounts).toBeUndefined();
      });
    });

    describe('match attemptCounts passthrough', () => {
      it('should include attemptCounts in score when provided', async () => {
        const freshId = (await service.join(session, 'MatchAttemptStudent')).studentId;
        await advanceToTask(service, session, freshId, 2);

        const result = await service.submit(session, freshId, 3, {
          pairs: ['skimming', 'scanning', 'inferring'],
          attemptCounts: { 0: 1, 1: 2, 2: 4 },
        });
        expect(result.score.total).toBe(100);
        expect(result.score.attemptCounts).toEqual({ p0: 1, p1: 2, p2: 4 });
      });
    });

    describe('no answerKey', () => {
      it('should return null score for step without answerKey', async () => {
        const created = await service.createSession('no-key-lesson');
        const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
        const sid = (await service.join(sess!, '无key学生')).studentId;

        const result = await service.submit(sess!, sid, 1, { text: 'some reading' });
        expect(result.score).toBeNull();

        // Submission still saved
        const sub = await submissionRepo.findOne({
          where: { sessionId: sess!.id, studentId: sid, step: 1 },
        });
        expect(sub).not.toBeNull();
        expect(sub!.dataJson).toEqual({ text: 'some reading' });
        expect(sub!.scoreJson).toBeNull();
      });
    });

    describe('lesson not found during grading', () => {
      it('should return null score when lesson row is missing from DB', async () => {
        // Create a temporary lesson, create a session, then delete the lesson
        await lessonRepo.save(lessonRepo.create({
          id: 'ephemeral-lesson',
          title: 'Ephemeral',
          subject: 'English',
          gradeLevel: '7',
          manifestJson: JSON.stringify({
            id: 'ephemeral-lesson',
            title: 'Ephemeral',
            readingSteps: [{ idx: 1, label: 'Q', strategy: 'quiz', answerKey: { type: 'quiz', answers: [{ questionIdx: 0, correct: 0, questionText: 'Q?', options: ['A', 'B'] }] } }],
          }),
        }));
        const created = await service.createSession('ephemeral-lesson');
        const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
        const sid = (await service.join(sess!, 'GhostStudent')).studentId;

        // Remove the lesson → gradeSubmission will hit !lesson branch
        await lessonRepo.delete('ephemeral-lesson');

        const result = await service.submit(sess!, sid, 1, { answers: [0] });
        expect(result.score).toBeNull();
      });
    });
  });

  // ── checkAnswer — buildCheckItems per-item feedback ──

  describe('checkAnswer — buildCheckItems', () => {
    let session: ClassroomSession;

    beforeAll(async () => {
      const created = await service.createSession('check-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });
    });

    describe('order — per-position items', () => {
      it('should return all correct when order matches', async () => {
        const sid = (await service.join(session, 'OrderCheckOK')).studentId;
        const result = await service.checkAnswer(session, sid, 1, {
          order: ['Introduction', 'Body', 'Conclusion'],
        });
        expect(result.type).toBe('order');
        expect(result.allCorrect).toBe(true);
        expect(result.items).toHaveLength(3);
        expect(result.items.every((it: any) => it.correct)).toBe(true);
        expect(result.items.map((it: any) => it.idx)).toEqual([0, 1, 2]);
      });

      it('should mark only wrong positions as incorrect', async () => {
        const sid = (await service.join(session, 'OrderCheckPartial')).studentId;
        // Swap first and last: [Conclusion, Body, Introduction]
        const result = await service.checkAnswer(session, sid, 1, {
          order: ['Conclusion', 'Body', 'Introduction'],
        });
        expect(result.type).toBe('order');
        expect(result.allCorrect).toBe(false);
        expect(result.items).toHaveLength(3);
        // Position 0: expected Introduction, got Conclusion → wrong
        expect(result.items[0]).toMatchObject({ idx: 0, correct: false });
        // Position 1: expected Body, got Body → correct
        expect(result.items[1]).toMatchObject({ idx: 1, correct: true });
        // Position 2: expected Conclusion, got Introduction → wrong
        expect(result.items[2]).toMatchObject({ idx: 2, correct: false });
      });

      it('should return all wrong when order is fully reversed', async () => {
        const sid = (await service.join(session, 'OrderCheckAllWrong')).studentId;
        const result = await service.checkAnswer(session, sid, 1, {
          order: ['Body', 'Conclusion', 'Introduction'],
        });
        expect(result.allCorrect).toBe(false);
        // None match: pos0 expects Intro got Body, pos1 expects Body got Conclusion, pos2 expects Conclusion got Intro
        expect(result.items[0]).toMatchObject({ idx: 0, correct: false });
        expect(result.items[1]).toMatchObject({ idx: 1, correct: false });
        expect(result.items[2]).toMatchObject({ idx: 2, correct: false });
      });
    });

    describe('map — per-item + LLM feedback', () => {
      beforeEach(() => {
        // Mock LLM call to prevent real API calls and timeouts
        jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValue(
          JSON.stringify({ items: [], overall: 'Test feedback' }),
        );
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('should return per-item correct flags based on placement and reasoning', async () => {
        const sid = (await service.join(session, 'MapCheckOK')).studentId;
        const result = await service.checkAnswer(session, sid, 3, {
          placements: { itemA: { x: 0.5, y: 0.5 }, itemB: { x: -0.5, y: -0.5 } },
          reasons: { itemA: 'Because it is important and new', itemB: 'Because it is low and old' },
        });
        expect(result.type).toBe('map');
        // Both placed, both reasoned (length >= 3), both positionScore = 100 (exact match)
        expect(result.items.length).toBeGreaterThanOrEqual(2);
        const itemA = result.items.find((it: any) => it.idx === 'itemA');
        const itemB = result.items.find((it: any) => it.idx === 'itemB');
        expect(itemA).toBeDefined();
        expect(itemB).toBeDefined();
        expect(itemA!.correct).toBe(true);
        expect(itemB!.correct).toBe(true);
      });

      it('should mark unplaced items as incorrect', async () => {
        const sid = (await service.join(session, 'MapCheckMissing')).studentId;
        const result = await service.checkAnswer(session, sid, 3, {
          placements: { itemA: { x: 0.5, y: 0.5 } },  // itemB not placed
          reasons: { itemA: 'Good reason here' },
        });
        const itemB = result.items.find((it: any) => it.idx === 'itemB');
        expect(itemB).toBeDefined();
        expect(itemB!.correct).toBe(false);
      });

      it('should mark items with short reasons as incorrect', async () => {
        const sid = (await service.join(session, 'MapCheckShortReason')).studentId;
        const result = await service.checkAnswer(session, sid, 3, {
          placements: { itemA: { x: 0.5, y: 0.5 }, itemB: { x: -0.5, y: -0.5 } },
          reasons: { itemA: 'ok', itemB: 'Because it is low and old' },  // itemA reason too short (< 3)
        });
        const itemA = result.items.find((it: any) => it.idx === 'itemA');
        const itemB = result.items.find((it: any) => it.idx === 'itemB');
        expect(itemA!.correct).toBe(false);  // reasoned = false (length < 3)
        expect(itemB!.correct).toBe(true);
      });
    });
  });

  // ── Score guard — submit flow ──

  describe('score guard — submit flow', () => {
    it('should not advance on wrong answer, then advance on correct resubmit', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'RetryStudent')).studentId;

      // Wrong answer: should NOT advance
      const wrong = await service.submit(sess!, sid, 1, { answers: [0, 1] });
      expect(wrong.score.total).toBe(0);
      expect(wrong.currentTask).toBe(1);
      expect(wrong.currentPhase).toBe('listen');

      // Correct answer: should advance
      const correct = await service.submit(sess!, sid, 1, { answers: [1, 0] });
      expect(correct.score.total).toBe(100);
      expect(correct.currentTask).toBe(2);
      expect(correct.currentPhase).toBe('listen');
    });

    it('should advance when score is null (no answerKey / open-ended)', async () => {
      const created = await service.createSession('no-key-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'OpenEndedStudent')).studentId;

      const result = await service.submit(sess!, sid, 1, { text: 'anything' });
      expect(result.score).toBeNull();
      // no-key-lesson has only 1 task → completing it marks as completed
      expect(result.currentTask).toBe(1);
      expect(result.currentPhase).toBe('completed');
    });
  });

  // ── SSE subscribe (#19) ──

  describe('SSE subscribe', () => {
    it('should send initial state with currentStep and activeNotifications', async () => {
      const created = await service.createSession('full-lesson');
      const session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      await service.join(session!, 'SSE学生');

      // Set teacher step and notification
      await service.setStep(created.sessionId, 5);
      service.notify(created.sessionId, '注意观察', 'highlight');

      // Mock Express Response with promise-based write spy
      const writtenChunks: string[] = [];
      let resolveInitialPush: () => void;
      const initialPush = new Promise<void>(r => { resolveInitialPush = r; });
      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn((chunk: string) => {
          writtenChunks.push(chunk);
          resolveInitialPush();
        }),
        on: jest.fn(),
      };

      service.subscribe(created.sessionId, mockRes as any);

      // Wait for the initial state push (promise-based, no setTimeout)
      await initialPush;

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.flushHeaders).toHaveBeenCalled();
      expect(mockRes.on).toHaveBeenCalledWith('close', expect.any(Function));

      // Parse initial SSE data
      expect(writtenChunks.length).toBeGreaterThanOrEqual(1);
      const dataLine = writtenChunks[0];
      expect(dataLine).toMatch(/^data: /);
      const payload = JSON.parse(dataLine.replace(/^data: /, '').replace(/\n\n$/, ''));

      expect(payload.currentStep).toBe(5);
      expect(payload.students.length).toBe(1);
      expect(payload.activeNotifications).toBeDefined();
      expect(payload.activeNotifications.length).toBe(1);
      expect(payload.activeNotifications[0].message).toBe('注意观察');

      // Cleanup: trigger close handler to clear heartbeat
      const closeHandler = mockRes.on.mock.calls.find(c => c[0] === 'close')?.[1];
      if (closeHandler) closeHandler();
    });
  });

  // ── Teacher dashboard enrichment (G2, G3, G6, stepMetrics) ──

  describe('teacher dashboard — enriched getState', () => {
    let session: ClassroomSession;
    let idA: string, idB: string, idC: string;

    beforeAll(async () => {
      const created = await service.createSession('full-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });

      idA = (await service.join(session, '仪表盘学生A')).studentId;
      idB = (await service.join(session, '仪表盘学生B')).studentId;
      idC = (await service.join(session, '仪表盘学生C')).studentId;

      // A: submits task 1 (perfect) and task 2 (all correct)
      await service.submit(session, idA, 1, { answers: [1, 0] });
      await service.submit(session, idA, 3, { pairs: ['skimming', 'scanning', 'inferring'] });

      // B: submits task 1 (all wrong)
      await service.submit(session, idB, 1, { answers: [0, 1] });

      // C: stays at task 1 (no submissions)

      // Add an AI question for student B at step 1
      const q = aiQuestionRepo.create({
        sessionId: session.id,
        studentId: idB,
        studentName: '仪表盘学生B',
        step: 1,
        question: '什么是predict？',
        answer: 'Predict是预测策略。',
        category: '概念理解',
      });
      await aiQuestionRepo.save(q);
    });

    it('should include byDimension with good/partial/wrong in stepMetrics', async () => {
      const state = await service.getState(session.id);
      const task1 = state.stepMetrics[1];

      // A got q0:true,q1:true; B got q0:false,q1:false → 2 students
      // byDimension now uses readable keys: q0→Q1, q1→Q2
      expect(task1.byDimension).toBeDefined();
      expect(task1.byDimension['Q1']).toBeDefined();
      expect(task1.byDimension['Q1'].good).toBe(50); // 1/2
      expect(task1.byDimension['Q1'].wrong).toBe(50); // 1/2
      expect(task1.byDimension['Q1'].partial).toBe(0);

      // Task 2: only A submitted, all correct (match: left→correct labels)
      const task2 = state.stepMetrics[2];
      expect(task2.byDimension['Skim→skimming']).toEqual({ good: 100, partial: 0, wrong: 0 });
    });

    it('should include avgTime and medianTime in stepMetrics', async () => {
      const state = await service.getState(session.id);
      const task1 = state.stepMetrics[1];

      // Both A and B submitted step 1, so timing data should exist
      // Exact values depend on test timing, just check type
      expect(typeof task1.avgTime).toBe('number');
      expect(typeof task1.medianTime).toBe('number');
      expect(task1.avgTime).toBeGreaterThanOrEqual(0);
      expect(task1.medianTime).toBeGreaterThanOrEqual(0);

      // Task 3: nobody submitted → null
      expect(state.stepMetrics[3].avgTime).toBeNull();
      expect(state.stepMetrics[3].medianTime).toBeNull();
    });

    it('should include aiRounds and aiPeople in stepMetrics', async () => {
      const state = await service.getState(session.id);
      const task1 = state.stepMetrics[1];

      // 1 AI question from student B at step 1
      expect(task1.aiRounds).toBe(1);
      expect(task1.aiPeople).toBe(1);

      // Task 2: no AI questions
      expect(state.stepMetrics[2].aiRounds).toBe(0);
      expect(state.stepMetrics[2].aiPeople).toBe(0);
    });

    it('should include duration and aiRoundsCount in student submissions (G2)', async () => {
      const state = await service.getState(session.id);

      // Student A: has submissions at step 1 and step 3
      const studentA = state.students.find(s => s.id === idA);
      expect(studentA!.submissions[1].duration).toBeDefined();
      expect(typeof studentA!.submissions[1].duration).toBe('number');
      expect(studentA!.submissions[1].aiRoundsCount).toBe(0); // no AI for A

      // Student B: has submission at step 1 with 1 AI question
      const studentB = state.students.find(s => s.id === idB);
      expect(studentB!.submissions[1].aiRoundsCount).toBe(1);
    });

    it('should include student status field (G3)', async () => {
      const state = await service.getState(session.id);

      // C has no submissions and is at task 1, phase 'listen' → reading
      const studentC = state.students.find(s => s.id === idC);
      expect(studentC!.status).toBe('reading');

      // A is at task 3, phase 'listen' (advanced by submitting task 2) → reading
      const studentA = state.students.find(s => s.id === idA);
      expect(studentA!.status).toBe('reading');
    });

    it('should return done status for completed student', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, '完成状态学生')).studentId;

      // Complete all 6 tasks
      await service.submit(sess!, sid, 1, { answers: [1, 0] });
      await service.submit(sess!, sid, 3, { pairs: ['skimming', 'scanning', 'inferring'] });
      await service.submit(sess!, sid, 5, {
        rows: [
          { place: 'Japan', practice: 'meditation', reason: 'focus' },
          { place: 'India', practice: 'yoga', reason: 'flexibility' },
        ],
      });
      await service.submit(sess!, sid, 7, { position: 'agree', evidence: ['e1', 'e2'] });
      await service.submit(sess!, sid, 9, { order: ['Introduction', 'Body', 'Conclusion'] });

      const state = await service.getState(sess!.id);
      const student = state.students.find(s => s.id === sid);
      expect(student!.status).toBe('done');
    });

    it('should include healthCards with correct structure (G6)', async () => {
      const state = await service.getState(session.id);

      expect(state.healthCards).toBeDefined();
      expect(state.healthCards.furthest).toBeDefined();
      expect(state.healthCards.median).toBeDefined();
      expect(state.healthCards.stuck).toBeDefined();
      expect(state.healthCards.aiTotal).toBeDefined();

      // A is at task 3, B at task 2, C at task 1 → furthest = 3
      expect(state.healthCards.furthest.step).toBe(3);
      expect(state.healthCards.furthest.count).toBe(1); // only A

      // Sorted tasks: [1, 1, 3] → median = 1 (B doesn't advance with score 0)
      expect(state.healthCards.median.step).toBe(1);

      // No stuck students in this scenario
      expect(state.healthCards.stuck.count).toBe(0);

      // AI totals: 1 question from 1 student
      expect(state.healthCards.aiTotal.rounds).toBe(1);
      expect(state.healthCards.aiTotal.people).toBe(1);
    });

    it('should preserve existing stepMetrics fields unchanged', async () => {
      const state = await service.getState(session.id);

      // Verify backward-compatible fields still correct
      expect(state.stepMetrics[1].completedCount).toBe(2); // A + B
      expect(state.stepMetrics[1].currentCount).toBe(1); // C at task 1
      expect(state.stepMetrics[1].completionRate).toBe(67); // 2/3
      expect(state.stepMetrics[1].avgScore).toBe(50); // (100+0)/2

      expect(state.stepMetrics[2].completedCount).toBe(1); // A
      expect(state.stepMetrics[2].currentCount).toBe(0); // B stays at task 1 (score 0)
    });

    // ── G1: quality.cols with human-readable dimension names ──

    it('should include quality.cols with human-readable names for quiz (G1)', async () => {
      const state = await service.getState(session.id);
      const task1 = state.stepMetrics[1];

      // quiz: q0→Q1, q1→Q2 (default mapping, no labels in FULL_MANIFEST)
      expect(task1.quality).toBeDefined();
      expect(task1.quality.cols).toBeDefined();
      expect(task1.quality.cols.length).toBe(2);

      const colNames = task1.quality.cols.map((c: any) => c.name);
      expect(colNames).toContain('Q1');
      expect(colNames).toContain('Q2');

      // Verify values match byDimension (keys are now readable)
      const q1Col = task1.quality.cols.find((c: any) => c.name === 'Q1');
      expect(q1Col.good).toBe(task1.byDimension['Q1'].good);
      expect(q1Col.wrong).toBe(task1.byDimension['Q1'].wrong);
    });

    it('should include quality.cols with readable names for match (G1)', async () => {
      const state = await service.getState(session.id);
      const task2 = state.stepMetrics[2];

      // match with left labels: left→correct format
      expect(task2.quality.cols.length).toBe(3);
      const colNames = task2.quality.cols.map((c: any) => c.name);
      expect(colNames).toContain('Skim→skimming');
      expect(colNames).toContain('Scan→scanning');
      expect(colNames).toContain('Infer→inferring');
    });

    // ── G4: alertTag ──

    it('should include alertTag as null when no alerts triggered (G4)', async () => {
      const state = await service.getState(session.id);
      // Task 1: Q1 wrong=50% ≥ 30% → alertTag should use readable name
      expect(state.stepMetrics[1].alertTag).toBe('Q1 错误偏高');

      // Task 3: no submissions → alertTag null
      expect(state.stepMetrics[3].alertTag).toBeNull();
    });

    // ── G5: questionAggregates ──

    it('should include questionAggregates with isHigh threshold >= 4 (G5)', async () => {
      const state = await service.getState(session.id);

      // Task 1: 1 AI question (category '概念理解') → isHigh = false (< 4)
      const task1 = state.stepMetrics[1];
      expect(task1.questionAggregates).toBeDefined();
      expect(task1.questionAggregates['概念理解']).toBeDefined();
      expect(task1.questionAggregates['概念理解'].count).toBe(1);
      expect(task1.questionAggregates['概念理解'].isHigh).toBe(false);

      // Task 2: no AI questions → empty aggregates
      expect(Object.keys(state.stepMetrics[2].questionAggregates).length).toBe(0);
    });

    // ── G7: issues ──

    it('should include issues array in stepMetrics (G7)', async () => {
      const state = await service.getState(session.id);

      // Task 1: A answered ['B','A'] (correct), B answered ['A','B'] (wrong)
      // Only 1 wrong per question → count < 2 → no issues
      expect(state.stepMetrics[1].issues).toBeDefined();
      expect(Array.isArray(state.stepMetrics[1].issues)).toBe(true);

      // Task 3: no submissions → no issues
      expect(state.stepMetrics[3].issues).toEqual([]);
    });
  });

  // ── G7: issues detection with multiple identical wrong answers ──

  describe('teacher dashboard — issues detection (G7)', () => {
    let session: ClassroomSession;

    beforeAll(async () => {
      const created = await service.createSession('full-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });

      // Submit quiz (step 1) from 4 students: 2 give same wrong answer for Q1
      const s1 = (await service.join(session, 'IssueA')).studentId;
      const s2 = (await service.join(session, 'IssueB')).studentId;
      const s3 = (await service.join(session, 'IssueC')).studentId;
      const s4 = (await service.join(session, 'IssueD')).studentId;

      // s1: Q1 wrong (chose C), Q2 correct
      await service.submit(session, s1, 1, { answers: [2, 0] });
      // s2: Q1 wrong (chose C), Q2 correct — same wrong answer as s1
      await service.submit(session, s2, 1, { answers: [2, 0] });
      // s3: Q1 wrong (chose D), Q2 wrong (chose B)
      await service.submit(session, s3, 1, { answers: [3, 1] });
      // s4: all correct
      await service.submit(session, s4, 1, { answers: [1, 0] });
    });

    it('should detect common wrong answers with count >= 2', async () => {
      const state = await service.getState(session.id);
      const issues = state.stepMetrics[1].issues;

      expect(issues.length).toBeGreaterThanOrEqual(1);
      // 2 students chose index 2 for Q1 (correct is 1)
      const q1Issue = issues.find((i: string) => i.includes('Q1') && i.includes('2'));
      expect(q1Issue).toBeDefined();
      expect(q1Issue).toMatch(/^2 人/);
    });

    it('should not include wrong answers with count < 2', async () => {
      const state = await service.getState(session.id);
      const issues = state.stepMetrics[1].issues;

      // Only 1 student chose index 3 for Q1 → should not appear
      const dIssue = issues.find((i: string) => i.includes('3'));
      expect(dIssue).toBeUndefined();
    });

    it('should sort issues by count descending', async () => {
      const state = await service.getState(session.id);
      const issues = state.stepMetrics[1].issues;

      // Extract counts from issue strings
      const counts = issues.map((i: string) => {
        const m = i.match(/^(\d+) 人/);
        return m ? parseInt(m[1]) : 0;
      });

      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
      }
    });
  });

  // ── G4: alertTag with wrong dimension threshold ──

  describe('teacher dashboard — alertTag (G4)', () => {
    it('should return alertTag when dimension wrong >= 30%', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      // 3 students all get Q1 wrong → wrong=100% for Q1 dimension
      const ids: string[] = [];
      for (const name of ['AlertA', 'AlertB', 'AlertC']) {
        ids.push((await service.join(sess!, name)).studentId);
      }
      for (const id of ids) {
        await service.submit(sess!, id, 1, { answers: [2, 0] }); // Q1 wrong, Q2 correct
      }

      const state = await service.getState(sess!.id);
      // Q1: wrong=100% ≥ 30% → alertTag should mention 错误偏高
      expect(state.stepMetrics[1].alertTag).toBeDefined();
      expect(state.stepMetrics[1].alertTag).toMatch(/错误偏高/);
    });

    it('should return null alertTag when no thresholds exceeded', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      // 1 student, all correct → no alerts
      const sid = (await service.join(sess!, 'PerfectStudent')).studentId;
      await service.submit(sess!, sid, 1, { answers: [1, 0] });

      const state = await service.getState(sess!.id);
      expect(state.stepMetrics[1].alertTag).toBeNull();
    });
  });

  // ── attemptMetrics aggregation ──

  describe('teacher dashboard — attemptMetrics', () => {
    it('should aggregate avgAttempts and walkthroughRate from attemptCounts', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      // Student A: Q1 took 3 tries (walkthrough), Q2 took 1 try
      const sidA = (await service.join(sess!, 'AttemptA')).studentId;
      await service.submit(sess!, sidA, 1, {
        answers: [1, 0],
        attemptCounts: { 0: 3, 1: 1 },
      });

      // Student B: Q1 took 1 try, Q2 took 2 tries (walkthrough)
      const sidB = (await service.join(sess!, 'AttemptB')).studentId;
      await service.submit(sess!, sidB, 1, {
        answers: [1, 0],
        attemptCounts: { 0: 1, 1: 2 },
      });

      const state = await service.getState(sess!.id);
      const am = state.stepMetrics[1].attemptMetrics;
      expect(am).toBeDefined();

      // Q1 label from manifest: answerKey.answers[0] has no label → fallback "Q1"
      // avgAttempts Q1: (3+1)/2 = 2.0, walkthroughRate: 1/2 = 50%
      // avgAttempts Q2: (1+2)/2 = 1.5, walkthroughRate: 1/2 = 50%
      const q1 = am['Q1'];
      expect(q1).toBeDefined();
      expect(q1.avgAttempts).toBe(2);
      expect(q1.walkthroughRate).toBe(50);

      const q2 = am['Q2'];
      expect(q2).toBeDefined();
      expect(q2.avgAttempts).toBe(1.5);
      expect(q2.walkthroughRate).toBe(50);
    });

    it('should show empty attemptMetrics when no attemptCounts provided', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      const sid = (await service.join(sess!, 'NoAttemptData')).studentId;
      await service.submit(sess!, sid, 1, { answers: [1, 0] });

      const state = await service.getState(sess!.id);
      expect(state.stepMetrics[1].attemptMetrics).toEqual({});
    });

    it('should trigger walkthroughRate alertTag when >= 50%', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      // 2 students both need walkthrough on Q1 (attempts >= 2)
      for (const name of ['WtA', 'WtB']) {
        const sid = (await service.join(sess!, name)).studentId;
        await service.submit(sess!, sid, 1, {
          answers: [1, 0],
          attemptCounts: { 0: 3, 1: 1 },
        });
      }

      const state = await service.getState(sess!.id);
      // Q1 walkthroughRate = 100% >= 50% → alertTag
      expect(state.stepMetrics[1].alertTag).toMatch(/半数需提示/);
    });

    it('should default to 1 when attemptCounts key is missing for a question', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'PartialKeys')).studentId;

      // attemptCounts only has key 0, missing key 1 → backend should fallback to 1
      const result = await service.submit(sess!, sid, 1, {
        answers: [1, 0],
        attemptCounts: { 0: 4 },
      });
      expect(result.score.attemptCounts).toEqual({ q0: 4, q1: 1 });
    });

    it('should prefer 错误偏高 over 半数需提示 (priority 2 > 2.5)', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      // 3 students all get Q1 wrong AND have high attempts → both alerts qualify
      for (const name of ['PrioA', 'PrioB', 'PrioC']) {
        const sid = (await service.join(sess!, name)).studentId;
        await service.submit(sess!, sid, 1, {
          answers: [2, 0], // Q1 wrong → wrong=100%
          attemptCounts: { 0: 5, 1: 1 }, // Q1 walkthrough
        });
      }

      const state = await service.getState(sess!.id);
      // wrong >= 30% fires first (priority 2), not 半数需提示 (priority 2.5)
      expect(state.stepMetrics[1].alertTag).toMatch(/错误偏高/);
    });

    it('should aggregate only students who sent attemptCounts', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      // Student A: sends attemptCounts
      const sidA = (await service.join(sess!, 'WithAttempts')).studentId;
      await service.submit(sess!, sidA, 1, {
        answers: [1, 0],
        attemptCounts: { 0: 4, 1: 2 },
      });

      // Student B: no attemptCounts (legacy client)
      const sidB = (await service.join(sess!, 'NoAttempts')).studentId;
      await service.submit(sess!, sidB, 1, {
        answers: [1, 0],
      });

      const state = await service.getState(sess!.id);
      const am = state.stepMetrics[1].attemptMetrics;
      // Only student A counted → avgAttempts = 4/1, not (4+0)/2
      expect(am['Q1'].avgAttempts).toBe(4);
      expect(am['Q2'].avgAttempts).toBe(2);
    });
  });

  // ── G5: questionAggregates isHigh threshold ──

  describe('teacher dashboard — questionAggregates isHigh (G5)', () => {
    it('should mark isHigh=true when count >= 4', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'QAStudent')).studentId;

      // Add 4 AI questions with same category
      for (let i = 0; i < 4; i++) {
        const q = aiQuestionRepo.create({
          sessionId: sess!.id,
          studentId: sid,
          studentName: 'QAStudent',
          step: 1,
          question: `问题${i}`,
          answer: `回答${i}`,
          category: '概念理解',
        });
        await aiQuestionRepo.save(q);
      }

      const state = await service.getState(sess!.id);
      const qa = state.stepMetrics[1].questionAggregates;
      expect(qa['概念理解'].count).toBe(4);
      expect(qa['概念理解'].isHigh).toBe(true);
    });

    it('should mark isHigh=false when count < 4', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'QALowStudent')).studentId;

      // Add 3 AI questions (below threshold)
      for (let i = 0; i < 3; i++) {
        const q = aiQuestionRepo.create({
          sessionId: sess!.id,
          studentId: sid,
          studentName: 'QALowStudent',
          step: 1,
          question: `问题${i}`,
          answer: `回答${i}`,
          category: '阅读策略',
        });
        await aiQuestionRepo.save(q);
      }

      const state = await service.getState(sess!.id);
      const qa = state.stepMetrics[1].questionAggregates;
      expect(qa['阅读策略'].count).toBe(3);
      expect(qa['阅读策略'].isHigh).toBe(false);
    });
  });

  // ── G1: quality.cols with labeled manifest ──

  describe('teacher dashboard — quality.cols with labeled manifest (G1)', () => {
    it('should use left→correct labels for match dimensions', async () => {
      // Create a lesson with match labels
      await lessonRepo.save(
        lessonRepo.create({
          id: 'labeled-lesson',
          title: 'Labeled Lesson',
          subject: 'English',
          gradeLevel: '7',
          manifestJson: JSON.stringify({
            id: 'labeled-lesson',
            title: 'Labeled Lesson',
            readingSteps: [
              {
                idx: 1,
                label: 'Quiz Step',
                strategy: 'quiz',
                answerKey: {
                  type: 'quiz',
                  answers: [
                    { questionIdx: 0, correct: 1, questionText: 'Edem', label: 'Edem', options: ['A', 'B'] },
                    { questionIdx: 1, correct: 0, questionText: 'Media', label: 'Media', options: ['A', 'B'] },
                  ],
                },
              },
              {
                idx: 3,
                label: 'Match Step',
                strategy: 'match',
                answerKey: {
                  type: 'match',
                  options: ['Phenomenon', 'History'],
                  answers: [
                    { pairIdx: 0, left: '¶1-2', correct: 'Phenomenon' },
                    { pairIdx: 1, left: '¶3-4', correct: 'History' },
                  ],
                },
              },
              { idx: 5, label: 'Matrix', strategy: 'matrix', answerKey: {
                type: 'matrix',
                answers: [
                  { rowIdx: 0, place: 'Japan', practice: 'meditation', reason: 'focus', isDemo: false },
                ],
              }},
              { idx: 7, label: 'Stance', strategy: 'stance', answerKey: {
                type: 'stance', validPositions: ['agree', 'disagree'], minEvidence: 2, stanceOpts: ['agree', 'disagree'], evidence: ['e1', 'e2'],
              }},
              { idx: 9, label: 'Order', strategy: 'order', answerKey: {
                type: 'order', items: ['A', 'B', 'C'], correctOrder: [0, 1, 2],
              }},
            ],
          }),
        }),
      );

      const created = await service.createSession('labeled-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'LabelStudent')).studentId;

      // Submit quiz with partial correct
      await service.submit(sess!, sid, 1, { answers: [1, 1] });

      const state = await service.getState(sess!.id);
      const quizCols = state.stepMetrics[1].quality.cols;

      // Labels from answerKey.answers[].label
      const names = quizCols.map((c: any) => c.name);
      expect(names).toContain('Edem');
      expect(names).toContain('Media');
    });

    it('should use Where/What/Why for matrix dimensions', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'MatrixStudent')).studentId;

      await advanceToTask(service, sess!, sid, 3);
      await service.submit(sess!, sid, 5, {
        rows: [
          { place: 'Japan', practice: 'meditation', reason: 'focus' },
          { place: 'wrong', practice: 'wrong', reason: 'wrong' },
        ],
      });

      const state = await service.getState(sess!.id);
      const matrixCols = state.stepMetrics[3].quality.cols;
      const names = matrixCols.map((c: any) => c.name);
      expect(names).toContain('Where');
      expect(names).toContain('What');
      expect(names).toContain('Why');
    });
  });

  // ── Empty classroom edge case ──

  describe('teacher dashboard — empty classroom', () => {
    it('should return empty healthCards and stepMetrics for 0 students', async () => {
      const created = await service.createSession('full-lesson');
      const state = await service.getState(created.sessionId);

      expect(state.students.length).toBe(0);
      expect(state.healthCards.furthest.step).toBe(0);
      expect(state.healthCards.median.step).toBe(0);
      expect(state.healthCards.stuck.count).toBe(0);

      for (let t = 1; t <= 5; t++) {
        expect(state.stepMetrics[t].completedCount).toBe(0);
        expect(state.stepMetrics[t].issues).toEqual([]);
        expect(state.stepMetrics[t].alertTag).toBeNull();
        expect(Object.keys(state.stepMetrics[t].questionAggregates).length).toBe(0);
      }
    });
  });

  // ── G3: stuck status detection ──

  describe('teacher dashboard — stuck status (G3)', () => {
    it('should return stuck status when student exceeds median × 1.5', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      // 2 students submit step 1 to create medianTime data for task 1
      const s1 = (await service.join(sess!, 'StuckTestA')).studentId;
      const s2 = (await service.join(sess!, 'StuckTestB')).studentId;
      const s3 = (await service.join(sess!, 'StuckTestC')).studentId;

      // Set joinedAt far in the past so durations are meaningful (not 0)
      for (const sid of [s1, s2]) {
        const stu = await studentRepo.findOne({ where: { id: sid } });
        stu!.joinedAt = new Date(Date.now() - 300 * 1000) as any; // 5 min ago
        await studentRepo.save(stu!);
      }

      await service.submit(sess!, s1, 1, { answers: [1, 0] });
      await service.submit(sess!, s2, 1, { answers: [1, 0] });

      // s3: manually set to non-listen phase with stepStartedAt far in the past
      const student3 = await studentRepo.findOne({ where: { id: s3 } });
      student3!.currentPhase = 'working';
      student3!.currentTask = 1;
      student3!.stepStartedAt = new Date(Date.now() - 999999 * 1000).toISOString();
      await studentRepo.save(student3!);

      const state = await service.getState(sess!.id);
      const studentC = state.students.find((s: any) => s.id === s3);
      expect(studentC!.status).toBe('stuck');
    });

    it('should return prog status when student is within median × 1.5', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      const s1 = (await service.join(sess!, 'ProgTestA')).studentId;
      const s2 = (await service.join(sess!, 'ProgTestB')).studentId;

      // Set joinedAt far in the past so medianTime > 0
      const stu1 = await studentRepo.findOne({ where: { id: s1 } });
      stu1!.joinedAt = new Date(Date.now() - 300 * 1000) as any;
      await studentRepo.save(stu1!);

      await service.submit(sess!, s1, 1, { answers: [1, 0] });

      // s2: non-listen, stepStartedAt is now (within threshold)
      const student2 = await studentRepo.findOne({ where: { id: s2 } });
      student2!.currentPhase = 'working';
      student2!.currentTask = 1;
      student2!.stepStartedAt = new Date().toISOString();
      await studentRepo.save(student2!);

      const state = await service.getState(sess!.id);
      const studentB = state.students.find((s: any) => s.id === s2);
      expect(studentB!.status).toBe('prog');
    });
  });

  // ── G7: match issue detection ──

  describe('teacher dashboard — match issue detection (G7)', () => {
    it('should detect common wrong answers for match type', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      const s1 = (await service.join(sess!, 'MatchIssueA')).studentId;
      const s2 = (await service.join(sess!, 'MatchIssueB')).studentId;

      // Advance both to task 2 (submit step 1 first)
      await service.submit(sess!, s1, 1, { answers: [1, 0] });
      await service.submit(sess!, s2, 1, { answers: [1, 0] });

      // Both submit match step with same wrong answer for pair 0
      // correct for p0 is 'skimming', both submit 'wrongValue'
      await service.submit(sess!, s1, 3, { pairs: ['wrongValue', 'scanning', 'inferring'] });
      await service.submit(sess!, s2, 3, { pairs: ['wrongValue', 'scanning', 'inferring'] });

      const state = await service.getState(sess!.id);
      const issues = state.stepMetrics[2].issues;

      expect(issues.length).toBeGreaterThanOrEqual(1);
      // P1 (pairIdx 0, no left label) matched wrongValue instead of skimming
      const matchIssue = issues.find((i: string) => i.includes('wrongValue'));
      expect(matchIssue).toBeDefined();
      expect(matchIssue).toMatch(/^2 人/);
      expect(matchIssue).toMatch(/skimming/);
    });
  });

  // ── G4: alertTag uses human-readable dimension names ──

  describe('teacher dashboard — alertTag readable names (G4)', () => {
    it('should use human-readable name in alertTag for quiz dimension', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      // 3 students all get Q1 wrong → q0 wrong=100% ≥ 30%
      for (const name of ['AlertNameA', 'AlertNameB', 'AlertNameC']) {
        const sid = (await service.join(sess!, name)).studentId;
        await service.submit(sess!, sid, 1, { answers: [2, 0] }); // Q1 wrong, Q2 correct
      }

      const state = await service.getState(sess!.id);
      // Should use 'Q1' (human-readable) not 'q0' (code key)
      expect(state.stepMetrics[1].alertTag).toBe('Q1 错误偏高');
    });

    it('should use Where/What/Why in alertTag for matrix dimension', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      const s1 = (await service.join(sess!, 'MatAlertA')).studentId;
      const s2 = (await service.join(sess!, 'MatAlertB')).studentId;

      // Advance both to task 3
      await advanceToTask(service, sess!, s1, 3);
      await advanceToTask(service, sess!, s2, 3);

      // Both submit matrix with all wrong answers
      await service.submit(sess!, s1, 5, { rows: [{ place: 'X', practice: 'X', reason: 'X' }, { place: 'X', practice: 'X', reason: 'X' }] });
      await service.submit(sess!, s2, 5, { rows: [{ place: 'X', practice: 'X', reason: 'X' }, { place: 'X', practice: 'X', reason: 'X' }] });

      const state = await service.getState(sess!.id);
      // place wrong=100% → alertTag should use 'Where' not 'place'
      expect(state.stepMetrics[3].alertTag).toMatch(/^(Where|What|Why) 错误偏高$/);
    });

    it('should prioritize stuck over wrong dimension in alertTag', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });

      // Create 5+ stuck students at task 1
      const stuckIds: string[] = [];
      for (let i = 0; i < 6; i++) {
        const sid = (await service.join(sess!, `StuckPri${i}`)).studentId;
        stuckIds.push(sid);
      }

      // Set joinedAt far in the past for first student so medianTime > 0
      const firstStu = await studentRepo.findOne({ where: { id: stuckIds[0] } });
      firstStu!.joinedAt = new Date(Date.now() - 300 * 1000) as any;
      await studentRepo.save(firstStu!);

      // One student submits to create medianTime
      await service.submit(sess!, stuckIds[0], 1, { answers: [2, 0] });

      // Set 5 students as stuck
      for (let i = 1; i <= 5; i++) {
        const student = await studentRepo.findOne({ where: { id: stuckIds[i] } });
        student!.currentPhase = 'working';
        student!.currentTask = 1;
        student!.stepStartedAt = new Date(Date.now() - 999999 * 1000).toISOString();
        await studentRepo.save(student!);
      }

      const state = await service.getState(sess!.id);
      // stuck >= 5 should take priority over dimension errors
      expect(state.stepMetrics[1].alertTag).toMatch(/人卡住$/);
    });
  });

  describe('teacher dashboard — stepMetrics name/desc/formatted times', () => {
    it('should include name and desc from manifest', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const state = await service.getState(sess!.id);

      expect(state.stepMetrics[1].name).toBe('Quiz Step');
      expect(state.stepMetrics[1].desc).toBe('选择题');
      expect(state.stepMetrics[2].name).toBe('Match Step');
      expect(state.stepMetrics[2].desc).toBe('结构匹配');
      expect(state.stepMetrics[3].name).toBe('Matrix Step');
      expect(state.stepMetrics[3].desc).toBe('信息矩阵');
      expect(state.stepMetrics[4].name).toBe('Stance Step');
      expect(state.stepMetrics[4].desc).toBe('立场+论据');
      expect(state.stepMetrics[5].name).toBe('Order Step');
      expect(state.stepMetrics[5].desc).toBe('策略排序');
    });

    it('should include formatted time strings when times are available', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'TimeStudent')).studentId;
      await service.submit(sess!, sid, 1, { answers: [1, 0] });

      const state = await service.getState(sess!.id);
      const task1 = state.stepMetrics[1];
      expect(task1.avgTimeFormatted).toMatch(/^\d+:\d{2}$/);
      expect(task1.medianTimeFormatted).toMatch(/^\d+:\d{2}$/);

      // No submissions for task 3 → null formatted times
      expect(state.stepMetrics[3].avgTimeFormatted).toBeNull();
      expect(state.stepMetrics[3].medianTimeFormatted).toBeNull();
    });
  });

  describe('teacher dashboard — stepHistory (per-student per-step)', () => {
    it('should include stepHistory with status/result for each task 1-5', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'HistoryStudent')).studentId;

      // Submit task 1 perfectly
      await service.submit(sess!, sid, 1, { answers: [1, 0] });
      // Submit task 2 with one wrong
      await service.submit(sess!, sid, 3, { pairs: ['skimming', 'wrong', 'inferring'] });

      const state = await service.getState(sess!.id);
      const student = state.students.find((s: any) => s.id === sid);
      expect(student!.stepHistory).toBeDefined();

      // Task 1: done, correct (100)
      expect(student!.stepHistory[1].status).toBe('done');
      expect(student!.stepHistory[1].result).toBe('correct');
      expect(student!.stepHistory[1].time).toMatch(/^\d+:\d{2}$/);

      // Task 2: still current (failed submission), result attached
      expect(['prog', 'reading']).toContain(student!.stepHistory[2].status);
      expect(student!.stepHistory[2].result).toBe('partial');

      // Tasks 3-5: future (task 2 wrong answer → student stays at task 2)
      expect(student!.stepHistory[3].status).toBe('future');
      expect(student!.stepHistory[4].status).toBe('future');
      expect(student!.stepHistory[5].status).toBe('future');
    });

    it('should include result and timeFormatted in enriched submissions', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'EnrichedSubStudent')).studentId;

      // Submit task 1 with wrong answers
      await service.submit(sess!, sid, 1, { answers: [0, 1] });

      const state = await service.getState(sess!.id);
      const student = state.students.find((s: any) => s.id === sid);
      const sub = student!.submissions[1];

      expect(sub.result).toBe('wrong');
      expect(sub.timeFormatted).toMatch(/^\d+:\d{2}$/);
    });

    it('should mark all 5 tasks as done for completed student', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'DoneStudent')).studentId;

      await service.submit(sess!, sid, 1, { answers: [1, 0] });
      await service.submit(sess!, sid, 3, { pairs: ['skimming', 'scanning', 'inferring'] });
      await service.submit(sess!, sid, 5, { rows: [
        { place: 'Japan', practice: 'meditation', reason: 'focus' },
        { place: 'India', practice: 'yoga', reason: 'flexibility' },
      ] });
      await service.submit(sess!, sid, 7, { position: 'agree', evidence: ['e1', 'e2'] });
      await service.submit(sess!, sid, 9, { order: ['Introduction', 'Body', 'Conclusion'] });

      const state = await service.getState(sess!.id);
      const student = state.students.find((s: any) => s.id === sid);

      for (let t = 1; t <= 5; t++) {
        expect(student!.stepHistory[t].status).toBe('done');
      }
    });
  });

  // ── Student-Teacher linkage: score guard + dashboard consistency ──

  describe('student-teacher linkage — score guard integration', () => {
    /**
     * Core scenario: one session, 3 students at different stages.
     * After each student action, verify teacher getState() reflects the
     * correct currentTask, status, stepHistory, metrics, and healthCards.
     */

    let session: ClassroomSession;
    let alice: string, bob: string, carol: string;

    beforeAll(async () => {
      const created = await service.createSession('full-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      alice = (await service.join(session, 'Alice')).studentId;
      bob = (await service.join(session, 'Bob')).studentId;
      carol = (await service.join(session, 'Carol')).studentId;
    });

    // ─── Phase 1: all students fresh, no submissions ───

    it('P1: teacher sees 3 students all at task 1 / reading before any submissions', async () => {
      const state = await service.getState(session.id);
      expect(state.students).toHaveLength(3);

      for (const s of state.students) {
        expect(s.currentTask).toBe(1);
        expect(s.currentPhase).toBe('listen');
        expect(s.status).toBe('reading');
        // All 5 steps: task 1 = reading/prog, tasks 2-5 = future
        expect(['reading', 'prog']).toContain(s.stepHistory[1].status);
        for (let t = 2; t <= 5; t++) {
          expect(s.stepHistory[t].status).toBe('future');
        }
      }

      // Metrics: nobody completed anything
      expect(state.stepMetrics[1].completedCount).toBe(0);
      expect(state.stepMetrics[1].currentCount).toBe(3);
      expect(state.healthCards.furthest.step).toBe(1);
      expect(state.healthCards.median.step).toBe(1);
    });

    // ─── Phase 2: Alice submits wrong → no advancement ───

    it('P2: Alice submits wrong — response shows no advancement', async () => {
      const res = await service.submit(session, alice, 1, { answers: [0, 1] });
      expect(res.score.total).toBe(0);
      expect(res.currentTask).toBe(1);
      expect(res.currentPhase).toBe('listen');
    });

    it('P2: teacher sees Alice still at task 1 with failed result, others unchanged', async () => {
      const state = await service.getState(session.id);
      const a = state.students.find((s: any) => s.id === alice);

      // Alice: still at task 1 despite submission
      expect(a!.currentTask).toBe(1);
      expect(a!.status).toBe('reading'); // listen phase = reading
      // stepHistory[1] should show current step with failed result attached
      expect(['prog', 'reading']).toContain(a!.stepHistory[1].status);
      expect(a!.stepHistory[1].result).toBe('wrong');

      // Submission is recorded even though progress didn't advance
      expect(a!.submissions[1]).toBeDefined();
      expect(a!.submissions[1].result).toBe('wrong');

      // stepMetrics: 1 completed (Alice submitted), but she's still current too
      // completedCount counts submissions, currentCount counts students without submissions at this task
      expect(state.stepMetrics[1].completedCount).toBe(1);
      expect(state.stepMetrics[1].currentCount).toBe(2); // Bob + Carol
      expect(state.stepMetrics[1].avgScore).toBe(0);

      // healthCards: everyone still at task 1
      expect(state.healthCards.furthest.step).toBe(1);
      expect(state.healthCards.median.step).toBe(1);
    });

    // ─── Phase 3: Alice retries with correct answer → advances ───

    it('P3: Alice retries correct — response shows advancement to task 2', async () => {
      const res = await service.submit(session, alice, 1, { answers: [1, 0] });
      expect(res.score.total).toBe(100);
      expect(res.currentTask).toBe(2);
      expect(res.currentPhase).toBe('listen');
    });

    it('P3: teacher sees Alice at task 2, submission overwritten to correct', async () => {
      const state = await service.getState(session.id);
      const a = state.students.find((s: any) => s.id === alice);

      expect(a!.currentTask).toBe(2);
      expect(a!.status).toBe('reading');
      // stepHistory[1] is now done/correct (advanced past it)
      expect(a!.stepHistory[1].status).toBe('done');
      expect(a!.stepHistory[1].result).toBe('correct');
      // stepHistory[2] is current
      expect(['reading', 'prog']).toContain(a!.stepHistory[2].status);

      // stepMetrics[1]: score is now 100 (overwrite replaces previous submission)
      expect(state.stepMetrics[1].completedCount).toBe(1);
      expect(state.stepMetrics[1].avgScore).toBe(100);

      // healthCards: Alice at task 2, Bob/Carol at task 1
      expect(state.healthCards.furthest.step).toBe(2);
      expect(state.healthCards.median.step).toBe(1); // [1, 1, 2] → median = 1
    });

    // ─��─ Phase 4: Bob submits perfect → advances; Carol submits wrong → stays ───

    it('P4: Bob perfect + Carol wrong — divergent outcomes', async () => {
      const bobRes = await service.submit(session, bob, 1, { answers: [1, 0] });
      expect(bobRes.score.total).toBe(100);
      expect(bobRes.currentTask).toBe(2);

      const carolRes = await service.submit(session, carol, 1, { answers: [1, 1] });
      expect(carolRes.score.total).toBe(50); // Q1 correct, Q2 wrong
      expect(carolRes.currentTask).toBe(1); // blocked
    });

    it('P4: teacher dashboard reflects divergent student states', async () => {
      const state = await service.getState(session.id);
      const a = state.students.find((s: any) => s.id === alice);
      const b = state.students.find((s: any) => s.id === bob);
      const c = state.students.find((s: any) => s.id === carol);

      expect(a!.currentTask).toBe(2);
      expect(b!.currentTask).toBe(2);
      expect(c!.currentTask).toBe(1); // stuck on task 1

      // stepMetrics[1]: all 3 submitted
      expect(state.stepMetrics[1].completedCount).toBe(3);
      // avgScore: (100 + 100 + 50) / 3 = 83.33 → round → 83
      expect(state.stepMetrics[1].avgScore).toBe(83);
      // completion rate: 3/3 = 100% (submitted, not necessarily advanced)
      expect(state.stepMetrics[1].completionRate).toBe(100);

      // byDimension: Q1 all correct, Q2 has one wrong (Carol: B instead of A)
      expect(state.stepMetrics[1].byDimension['Q1'].good).toBe(100);
      expect(state.stepMetrics[1].byDimension['Q2'].wrong).toBeGreaterThan(0);

      // healthCards: [2, 2, 1] → median = 2, furthest = 2
      expect(state.healthCards.furthest.step).toBe(2);
      expect(state.healthCards.furthest.count).toBe(2); // Alice + Bob
      expect(state.healthCards.median.step).toBe(2); // sorted [1,2,2]→ idx 1 = 2

      // Carol's stepHistory: task 1 shows current with partial result
      expect(['prog', 'reading']).toContain(c!.stepHistory[1].status);
      expect(c!.stepHistory[1].result).toBe('partial');
      expect(c!.stepHistory[2].status).toBe('future');
    });

    // ─── Phase 5: Alice races ahead to task 4, Bob at task 2, Carol fixes task 1 ───

    it('P5: Alice advances to task 4, Carol retries task 1 correctly', async () => {
      // Alice: task 2 perfect, task 3 perfect → reaches task 4
      await service.submit(session, alice, 3, { pairs: ['skimming', 'scanning', 'inferring'] });
      const aliceRes = await service.submit(session, alice, 5, {
        rows: [
          { place: 'Japan', practice: 'meditation', reason: 'focus' },
          { place: 'India', practice: 'yoga', reason: 'flexibility' },
        ],
      });
      expect(aliceRes.currentTask).toBe(4);

      // Carol: retry task 1 with correct answers
      const carolRes = await service.submit(session, carol, 1, { answers: [1, 0] });
      expect(carolRes.score.total).toBe(100);
      expect(carolRes.currentTask).toBe(2);
    });

    it('P5: teacher sees wide spread — healthCards reflect gap', async () => {
      const state = await service.getState(session.id);
      const a = state.students.find((s: any) => s.id === alice);
      const b = state.students.find((s: any) => s.id === bob);
      const c = state.students.find((s: any) => s.id === carol);

      expect(a!.currentTask).toBe(4);
      expect(b!.currentTask).toBe(2);
      expect(c!.currentTask).toBe(2);

      // Alice done steps 1-3, currently on 4
      expect(a!.stepHistory[1].status).toBe('done');
      expect(a!.stepHistory[2].status).toBe('done');
      expect(a!.stepHistory[3].status).toBe('done');
      expect(['reading', 'prog']).toContain(a!.stepHistory[4].status);
      expect(a!.stepHistory[5].status).toBe('future');

      // [4, 2, 2] → sorted [2, 2, 4]
      expect(state.healthCards.furthest.step).toBe(4);
      expect(state.healthCards.furthest.count).toBe(1);
      expect(state.healthCards.median.step).toBe(2);

      // stepMetrics[3]: only Alice completed
      expect(state.stepMetrics[3].completedCount).toBe(1);
      expect(state.stepMetrics[3].avgScore).toBe(100);
    });

    // ─── Phase 6: all complete → teacher sees all done ───

    it('P6: all students complete all tasks', async () => {
      // Bob: complete tasks 2-5
      await service.submit(session, bob, 3, { pairs: ['skimming', 'scanning', 'inferring'] });
      await service.submit(session, bob, 5, {
        rows: [
          { place: 'Japan', practice: 'meditation', reason: 'focus' },
          { place: 'India', practice: 'yoga', reason: 'flexibility' },
        ],
      });
      await service.submit(session, bob, 7, { position: 'agree', evidence: ['e1', 'e2'] });
      await service.submit(session, bob, 9, { order: ['Introduction', 'Body', 'Conclusion'] });

      // Carol: complete tasks 2-5
      await service.submit(session, carol, 3, { pairs: ['skimming', 'scanning', 'inferring'] });
      await service.submit(session, carol, 5, {
        rows: [
          { place: 'Japan', practice: 'meditation', reason: 'focus' },
          { place: 'India', practice: 'yoga', reason: 'flexibility' },
        ],
      });
      await service.submit(session, carol, 7, { position: 'agree', evidence: ['e1', 'e2'] });
      await service.submit(session, carol, 9, { order: ['Introduction', 'Body', 'Conclusion'] });

      // Alice: complete tasks 4-5
      await service.submit(session, alice, 7, { position: 'agree', evidence: ['e1', 'e2'] });
      await service.submit(session, alice, 9, { order: ['Introduction', 'Body', 'Conclusion'] });
    });

    it('P6: teacher sees all students done with correct metrics', async () => {
      const state = await service.getState(session.id);

      for (const s of state.students) {
        expect(s.currentPhase).toBe('completed');
        expect(s.status).toBe('done');
        for (let t = 1; t <= 5; t++) {
          expect(s.stepHistory[t].status).toBe('done');
        }
      }

      // All 5 steps: 3 students completed each
      for (let t = 1; t <= 5; t++) {
        expect(state.stepMetrics[t].completedCount).toBe(3);
        expect(state.stepMetrics[t].completionRate).toBe(100);
      }

      expect(state.healthCards.furthest.step).toBe(5);
      expect(state.healthCards.median.step).toBe(5);
      expect(state.healthCards.stuck.count).toBe(0);
    });
  });

  describe('student-teacher linkage — partial score edge cases', () => {
    it('match step: 2/3 correct → score 67, no advancement; 3/3 → advances', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'MatchStudent')).studentId;

      // Advance to task 2 first
      await advanceToTask(service, sess!, sid, 2);

      // 2/3 correct → ~67 → blocked
      const partial = await service.submit(sess!, sid, 3, {
        pairs: ['skimming', 'wrong', 'inferring'],
      });
      expect(partial.score.total).toBe(67);
      expect(partial.currentTask).toBe(2);

      // Teacher: student still at task 2 with partial result
      const state1 = await service.getState(sess!.id);
      const s1 = state1.students.find((s: any) => s.id === sid);
      expect(s1!.currentTask).toBe(2);
      expect(['prog', 'reading']).toContain(s1!.stepHistory[2].status);
      expect(s1!.stepHistory[2].result).toBe('partial');

      // Fix and resubmit
      const correct = await service.submit(sess!, sid, 3, {
        pairs: ['skimming', 'scanning', 'inferring'],
      });
      expect(correct.score.total).toBe(100);
      expect(correct.currentTask).toBe(3);

      // Teacher: student advanced
      const state2 = await service.getState(sess!.id);
      const s2 = state2.students.find((s: any) => s.id === sid);
      expect(s2!.currentTask).toBe(3);
      expect(s2!.stepHistory[2].status).toBe('done');
      expect(s2!.stepHistory[2].result).toBe('correct');
    });

    it('matrix step: partial answers → blocked; full correct → advances', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'MatrixStudent')).studentId;

      await advanceToTask(service, sess!, sid, 3);

      // Only 1 of 2 rows, wrong content → score ≈ 0
      const partial = await service.submit(sess!, sid, 5, {
        rows: [{ place: 'Narnia', practice: 'magic', reason: 'fun' }],
      });
      expect(partial.score.total).toBeLessThan(100);
      expect(partial.currentTask).toBe(3);

      // Correct both rows
      const correct = await service.submit(sess!, sid, 5, {
        rows: [
          { place: 'Japan', practice: 'meditation', reason: 'focus' },
          { place: 'India', practice: 'yoga', reason: 'flexibility' },
        ],
      });
      expect(correct.score.total).toBe(100);
      expect(correct.currentTask).toBe(4);

      // Teacher: task 3 shows done/correct in stepHistory
      const state = await service.getState(sess!.id);
      const s = state.students.find((st: any) => st.id === sid);
      expect(s!.stepHistory[3].status).toBe('done');
      expect(s!.stepHistory[3].result).toBe('correct');
    });

    it('stance step: valid position but too few evidence → 50, blocked', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'StanceStudent')).studentId;

      await advanceToTask(service, sess!, sid, 4);

      // Only 1 evidence item (min is 2)
      const partial = await service.submit(sess!, sid, 7, {
        position: 'agree', evidence: ['only_one'],
      });
      expect(partial.score.total).toBe(50);
      expect(partial.currentTask).toBe(4);

      // Teacher: student at task 4 with partial result
      const state = await service.getState(sess!.id);
      const s = state.students.find((st: any) => st.id === sid);
      expect(s!.stepHistory[4].result).toBe('partial');
      expect(['prog', 'reading']).toContain(s!.stepHistory[4].status);
    });

    it('order step: wrong order → blocked; correct order → advances', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'OrderStudent')).studentId;

      await advanceToTask(service, sess!, sid, 5);

      // Wrong order
      const wrong = await service.submit(sess!, sid, 9, {
        order: ['Conclusion', 'Body', 'Introduction'],
      });
      expect(wrong.score.total).toBeLessThan(100);
      expect(wrong.currentTask).toBe(5);
      expect(wrong.currentPhase).not.toBe('completed');

      // Correct order → completes (task 5 is the last)
      const correct = await service.submit(sess!, sid, 9, {
        order: ['Introduction', 'Body', 'Conclusion'],
      });
      expect(correct.score.total).toBe(100);
      expect(correct.currentTask).toBe(5);
      expect(correct.currentPhase).toBe('completed');

      // Teacher: student completed, order step done
      const state = await service.getState(sess!.id);
      const s = state.students.find((st: any) => st.id === sid);
      expect(s!.stepHistory[5].status).toBe('done');
      expect(s!.stepHistory[5].result).toBe('correct');
    });
  });

  describe('student-teacher linkage — multi-student metrics accuracy', () => {
    it('byDimension correctly aggregates wrong answers from blocked students', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const s1 = (await service.join(sess!, 'DimStudent1')).studentId;
      const s2 = (await service.join(sess!, 'DimStudent2')).studentId;
      const s3 = (await service.join(sess!, 'DimStudent3')).studentId;

      // S1: both correct
      await service.submit(sess!, s1, 1, { answers: [1, 0] });
      // S2: Q1 wrong, Q2 correct
      await service.submit(sess!, s2, 1, { answers: [0, 0] });
      // S3: Q1 correct, Q2 wrong
      await service.submit(sess!, s3, 1, { answers: [1, 1] });

      const state = await service.getState(sess!.id);
      const task1 = state.stepMetrics[1];

      // Q1: 2 good (S1, S3), 1 wrong (S2) → good=67%, wrong=33%
      expect(task1.byDimension['Q1'].good).toBe(67);
      expect(task1.byDimension['Q1'].wrong).toBe(33);

      // Q2: 2 good (S1, S2), 1 wrong (S3) → good=67%, wrong=33%
      expect(task1.byDimension['Q2'].good).toBe(67);
      expect(task1.byDimension['Q2'].wrong).toBe(33);

      // S1 advanced (100), S2 and S3 blocked (50 each)
      const st1 = state.students.find((s: any) => s.id === s1);
      const st2 = state.students.find((s: any) => s.id === s2);
      const st3 = state.students.find((s: any) => s.id === s3);
      expect(st1!.currentTask).toBe(2);
      expect(st2!.currentTask).toBe(1);
      expect(st3!.currentTask).toBe(1);

      // avgScore: (100 + 50 + 50) / 3 = 67
      expect(task1.avgScore).toBe(67);
    });

    it('stepMetrics counts are correct when some students skip ahead and others are blocked', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const fast = (await service.join(sess!, 'FastStudent')).studentId;
      const slow = (await service.join(sess!, 'SlowStudent')).studentId;
      const stuck = (await service.join(sess!, 'StuckStudent')).studentId;

      // Fast: completes tasks 1-3
      await advanceToTask(service, sess!, fast, 4);
      // Slow: completes task 1 only
      await service.submit(sess!, slow, 1, { answers: [1, 0] });
      // Stuck: fails task 1
      await service.submit(sess!, stuck, 1, { answers: [0, 1] });

      const state = await service.getState(sess!.id);

      // Task 1: all 3 submitted (completedCount=3), 0 currently at task 1 without submission
      // But stuck student submitted and is still at task 1 — the count logic:
      // completedCount = students with submission for this step
      // currentCount = students at this task WITHOUT submission
      expect(state.stepMetrics[1].completedCount).toBe(3);
      expect(state.stepMetrics[1].currentCount).toBe(0);

      // Task 2: only fast submitted, slow is current (no submission), stuck is below
      expect(state.stepMetrics[2].completedCount).toBe(1);
      expect(state.stepMetrics[2].currentCount).toBe(1); // slow at task 2

      // Task 3: only fast submitted
      expect(state.stepMetrics[3].completedCount).toBe(1);
      expect(state.stepMetrics[3].currentCount).toBe(0);

      // Task 4: nobody submitted, fast is current
      expect(state.stepMetrics[4].completedCount).toBe(0);
      expect(state.stepMetrics[4].currentCount).toBe(1); // fast at task 4

      // healthCards: [4, 2, 1] → sorted [1, 2, 4]
      expect(state.healthCards.furthest.step).toBe(4);
      expect(state.healthCards.median.step).toBe(2);
    });
  });

  describe('student-teacher linkage — open-ended / no-rubric steps', () => {
    it('open-ended step always advances (null score)', async () => {
      const created = await service.createSession('no-key-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'OpenStudent')).studentId;

      const res = await service.submit(sess!, sid, 1, { text: 'my reflection' });
      expect(res.score).toBeNull();
      // no-key-lesson has only 1 task → completing it marks as completed
      expect(res.currentTask).toBe(1);
      expect(res.currentPhase).toBe('completed');

      // Teacher: student completed, submission recorded
      const state = await service.getState(sess!.id);
      const s = state.students.find((st: any) => st.id === sid);
      expect(s!.currentTask).toBe(1);
      expect(s!.submissions[1]).toBeDefined();
      expect(s!.submissions[1].score).toBeNull();
    });
  });

  describe('student-teacher linkage — SSE broadcast triggers', () => {
    it('submit (wrong or correct) triggers broadcast — teacher SSE gets updated state', async () => {
      const created = await service.createSession('full-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'SSEStudent')).studentId;

      // Track broadcasts via SSE mock
      const writtenChunks: string[] = [];
      let resolveWrite: () => void;
      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn((chunk: string) => {
          writtenChunks.push(chunk);
          if (resolveWrite) resolveWrite();
        }),
        on: jest.fn(),
      };
      service.subscribe(created.sessionId, mockRes as any);

      // Wait for initial state push
      await new Promise<void>(r => { resolveWrite = r; });
      const initialChunkCount = writtenChunks.length;

      // Wrong answer — should still trigger broadcast
      let broadcastReceived = new Promise<void>(r => { resolveWrite = r; });
      await service.submit(sess!, sid, 1, { answers: [0, 1] });
      await broadcastReceived;
      expect(writtenChunks.length).toBeGreaterThan(initialChunkCount);

      // Parse broadcast: student still at task 1
      const afterWrong = writtenChunks.length;
      const wrongPayload = JSON.parse(
        writtenChunks[afterWrong - 1].replace(/^data: /, '').replace(/\n\n$/, ''),
      );
      const studentInWrongBroadcast = wrongPayload.students.find((s: any) => s.id === sid);
      expect(studentInWrongBroadcast.currentTask).toBe(1);

      // Correct answer — triggers another broadcast
      broadcastReceived = new Promise<void>(r => { resolveWrite = r; });
      await service.submit(sess!, sid, 1, { answers: [1, 0] });
      await broadcastReceived;
      expect(writtenChunks.length).toBeGreaterThan(afterWrong);

      // Parse: student now at task 2
      const correctPayload = JSON.parse(
        writtenChunks[writtenChunks.length - 1].replace(/^data: /, '').replace(/\n\n$/, ''),
      );
      const studentInCorrectBroadcast = correctPayload.students.find((s: any) => s.id === sid);
      expect(studentInCorrectBroadcast.currentTask).toBe(2);

      // Cleanup SSE
      const closeHandler = mockRes.on.mock.calls.find((c: any) => c[0] === 'close')?.[1];
      if (closeHandler) closeHandler();
    });
  });

  // ── Gap 1: Cross-step submission guard ──

  describe('cross-step submission guard', () => {
    let session: ClassroomSession;
    let sid: string;

    beforeAll(async () => {
      const created = await service.createSession('full-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      sid = (await service.join(session, 'CrossStepStudent')).studentId;
    });

    it('should NOT skip ahead when task-1 student submits step 9 with perfect answer', async () => {
      // Student at task 1 submits step 9 (task 5) with correct answer
      const res = await service.submit(session, sid, 9, {
        order: ['Introduction', 'Body', 'Conclusion'],
      });
      // Submission saved and graded
      expect(res.score.total).toBe(100);
      // But student stays at task 1
      expect(res.currentTask).toBe(1);
      expect(res.currentPhase).toBe('listen');
    });

    it('should NOT skip ahead when task-1 student submits step 9 with wrong answer', async () => {
      const res = await service.submit(session, sid, 9, {
        order: ['Conclusion', 'Body', 'Introduction'],
      });
      expect(res.score.total).toBeLessThan(100);
      expect(res.currentTask).toBe(1);
      expect(res.currentPhase).toBe('listen');
    });

    it('should still persist cross-step submissions in DB', async () => {
      const sub = await submissionRepo.findOne({
        where: { sessionId: session.id, studentId: sid, step: 9 },
      });
      expect(sub).not.toBeNull();
      expect(sub!.scoreJson).toBeDefined();
    });

    it('should advance normally when submitting the current task step', async () => {
      const res = await service.submit(session, sid, 1, { answers: [1, 0] });
      expect(res.score.total).toBe(100);
      expect(res.currentTask).toBe(2);
      expect(res.currentPhase).toBe('listen');
    });
  });

  // ── Gap 2: Re-submit lower score does not regress progress ──

  describe('re-submit lower score — no progress regression', () => {
    let session: ClassroomSession;
    let sid: string;

    beforeAll(async () => {
      const created = await service.createSession('full-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      sid = (await service.join(session, 'ResubmitStudent')).studentId;

      // Pass task 1 → advance to task 2
      await service.submit(session, sid, 1, { answers: [1, 0] });
    });

    it('student should be at task 2 after passing task 1', async () => {
      const student = await studentRepo.findOne({ where: { id: sid } });
      expect(student!.currentTask).toBe(2);
    });

    it('re-submitting step 1 with wrong answer should NOT regress to task 1', async () => {
      const res = await service.submit(session, sid, 1, { answers: [0, 1] });
      expect(res.score.total).toBe(0);
      // Still at task 2
      expect(res.currentTask).toBe(2);
      expect(res.currentPhase).toBe('listen');
    });

    it('DB submission should be overwritten with new (lower) score', async () => {
      const sub = await submissionRepo.findOne({
        where: { sessionId: session.id, studentId: sid, step: 1 },
      });
      expect(sub).not.toBeNull();
      expect(sub!.scoreJson.total).toBe(0);
    });

    it('teacher getState() stepHistory[1] still shows done (currentTask > 1)', async () => {
      const state = await service.getState(session.id);
      const student = state.students.find((s: any) => s.id === sid);
      // currentTask=2 > task 1, so stepHistory[1] should be 'done'
      expect(student.stepHistory[1].status).toBe('done');
    });

    it('teacher stepMetrics[1].avgScore reflects latest (lower) score', async () => {
      const state = await service.getState(session.id);
      expect(state.stepMetrics[1].avgScore).toBe(0);
    });
  });

  // ── Gap 3: Failed submission does not update stepStartedAt ──

  describe('stepStartedAt — only updated on task advancement', () => {
    let session: ClassroomSession;
    let sid: string;

    beforeAll(async () => {
      const created = await service.createSession('full-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      sid = (await service.join(session, 'TimingStudent')).studentId;

      // Advance to task 2
      await service.submit(session, sid, 1, { answers: [1, 0] });
    });

    it('wrong answer on task 2 should NOT change stepStartedAt', async () => {
      const before = await studentRepo.findOne({ where: { id: sid } });
      const t0 = before!.stepStartedAt;
      expect(t0).toBeDefined();

      // Small delay to ensure timestamps would differ
      await new Promise(r => setTimeout(r, 10));

      await service.submit(session, sid, 3, { pairs: ['wrong', 'wrong', 'wrong'] });

      const after = await studentRepo.findOne({ where: { id: sid } });
      expect(after!.currentTask).toBe(2); // not advanced
      expect(after!.stepStartedAt).toBe(t0); // unchanged
    });

    it('correct answer on task 2 should update stepStartedAt on advancement', async () => {
      const before = await studentRepo.findOne({ where: { id: sid } });
      const t0 = before!.stepStartedAt;

      await new Promise(r => setTimeout(r, 10));

      await service.submit(session, sid, 3, {
        pairs: ['skimming', 'scanning', 'inferring'],
      });

      const after = await studentRepo.findOne({ where: { id: sid } });
      expect(after!.currentTask).toBe(3); // advanced
      expect(after!.stepStartedAt).not.toBe(t0); // updated
    });
  });

  // ── Gap 4: allDone status with synthetic submissions ──

  describe('computeStudentStatus — allDone with non-sequential submissions', () => {
    let session: ClassroomSession;
    let sid: string;

    beforeAll(async () => {
      const created = await service.createSession('full-lesson');
      session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      sid = (await service.join(session, 'SyntheticStudent')).studentId;

      // Directly insert 6 submissions into DB (bypassing submit flow)
      for (const step of [1, 3, 5, 7, 9]) {
        await submissionRepo.save(
          submissionRepo.create({
            sessionId: session.id,
            lessonId: session.lessonId,
            studentId: sid,
            step,
            dataJson: { synthetic: true },
            scoreJson: { total: 0 },
          }),
        );
      }
      // Student remains at currentTask=1, currentPhase='listen'
    });

    it('student should still be at task 1 despite 6 DB submissions', async () => {
      const student = await studentRepo.findOne({ where: { id: sid } });
      expect(student!.currentTask).toBe(1);
      expect(student!.currentPhase).toBe('listen');
    });

    it('getState allDone check returns done — documents known assumption', async () => {
      // With the cross-step guard, this path is unreachable in normal flow.
      // But if submissions are injected directly into DB, allDone triggers 'done'
      // even though student.currentPhase !== 'completed'.
      // This is a known assumption documented in computeStudentStatus.
      const state = await service.getState(session.id);
      const student = state.students.find((s: any) => s.id === sid);
      // allDone fires because all 6 submissions exist — this documents the behavior
      expect(student.status).toBe('done');
    });
  });
});

// ════════════════════════════════════════════════════════════════
// 3-task lesson — verifies dynamic TaskMap (no hardcoded 5-task assumption)
// ════════════════════════════════════════════════════════════════

const THREE_TASK_MANIFEST = {
  id: 'three-task-lesson',
  title: 'Three Task Lesson',
  readingSteps: [
    {
      idx: 0, type: 'task', label: 'T1', strategy: 'quiz',
      answerKey: { type: 'quiz', answers: [{ questionIdx: 0, correct: 0, questionText: 'Q1?', options: ['A', 'B', 'C'] }] },
    },
    {
      idx: 2, type: 'task', label: 'T2', strategy: 'quiz',
      answerKey: { type: 'quiz', answers: [{ questionIdx: 0, correct: 1, questionText: 'Q2?', options: ['A', 'B', 'C'] }] },
    },
    {
      idx: 4, type: 'task', label: 'T3', strategy: 'quiz',
      answerKey: { type: 'quiz', answers: [{ questionIdx: 0, correct: 2, questionText: 'Q3?', options: ['A', 'B', 'C'] }] },
    },
  ],
};

describe('ClassroomService — 3-task lesson (dynamic TaskMap)', () => {
  let module: TestingModule;
  let service: ClassroomService;
  let sessionRepo: Repository<ClassroomSession>;
  let studentRepo: Repository<Student>;
  let lessonRepo: Repository<Lesson>;

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
      providers: [
        ClassroomService, ObservationService, GradingService, AiPromptBuilder, MetricsAggregator,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    service = module.get(ClassroomService);
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    studentRepo = module.get(getRepositoryToken(Student));
    lessonRepo = module.get(getRepositoryToken(Lesson));

    await lessonRepo.save(
      lessonRepo.create({
        id: 'three-task-lesson',
        title: 'Three Task Lesson',
        subject: 'English',
        gradeLevel: '7',
        manifestJson: JSON.stringify(THREE_TASK_MANIFEST),
      }),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  it('should advance through 3 tasks and complete on last', async () => {
    const created = await service.createSession('three-task-lesson');
    const session = await sessionRepo.findOne({ where: { id: created.sessionId } });
    const sid = (await service.join(session!, '三题学生')).studentId;

    // T1 (idx=0) → currentTask=2
    const r1 = await service.submit(session!, sid, 0, { answers: [0] });
    expect(r1.score.total).toBe(100);
    expect(r1.currentTask).toBe(2);
    expect(r1.currentPhase).toBe('listen');

    // T2 (idx=2) → currentTask=3
    const r2 = await service.submit(session!, sid, 2, { answers: [1] });
    expect(r2.score.total).toBe(100);
    expect(r2.currentTask).toBe(3);
    expect(r2.currentPhase).toBe('listen');

    // T3 (idx=4) → completed (maxTask=3, not hardcoded 5)
    const r3 = await service.submit(session!, sid, 4, { answers: [2] });
    expect(r3.score.total).toBe(100);
    expect(r3.currentTask).toBe(3);
    expect(r3.currentPhase).toBe('completed');
  });

  it('should produce stepMetrics with 3 keys', async () => {
    const created = await service.createSession('three-task-lesson');
    const session = await sessionRepo.findOne({ where: { id: created.sessionId } });
    await service.join(session!, '指标学生');

    const state = await service.getState(session!.id);
    const taskNums = Object.keys(state.stepMetrics).map(Number).sort((a, b) => a - b);
    expect(taskNums).toEqual([1, 2, 3]);
    // No task 4 or 5
    expect(state.stepMetrics[4]).toBeUndefined();
    expect(state.stepMetrics[5]).toBeUndefined();
  });

  it('should check allDone using [0, 2, 4] not [1, 3, 5, 7, 9]', async () => {
    const created = await service.createSession('three-task-lesson');
    const session = await sessionRepo.findOne({ where: { id: created.sessionId } });
    const sid = (await service.join(session!, '完成检查学生')).studentId;

    // Complete all 3 tasks
    await service.submit(session!, sid, 0, { answers: [0] });
    await service.submit(session!, sid, 2, { answers: [1] });
    await service.submit(session!, sid, 4, { answers: [2] });

    const state = await service.getState(session!.id);
    const student = state.students.find((s: any) => s.id === sid);
    expect(student!.status).toBe('done');
    expect(student!.currentPhase).toBe('completed');
  });

  it('should show correct healthCards for 3-task lesson', async () => {
    const created = await service.createSession('three-task-lesson');
    const session = await sessionRepo.findOne({ where: { id: created.sessionId } });
    const sid = (await service.join(session!, '健康卡学生')).studentId;

    // Complete all 3 tasks
    await service.submit(session!, sid, 0, { answers: [0] });
    await service.submit(session!, sid, 2, { answers: [1] });
    await service.submit(session!, sid, 4, { answers: [2] });

    const state = await service.getState(session!.id);
    // Completed student: effectiveTask = maxTask(3), not hardcoded 5
    expect(state.healthCards.furthest.step).toBe(3);
  });
});

// ── aiDiscuss quality passthrough ──

describe('ClassroomService — aiDiscuss quality gate', () => {
  let module: TestingModule;
  let service: ClassroomService;
  let aiPromptBuilder: AiPromptBuilder;
  let sessionRepo: Repository<ClassroomSession>;
  let lessonRepo: Repository<Lesson>;
  let session: ClassroomSession;
  let studentId: string;

  const DISCUSS_MANIFEST = {
    id: 'discuss-lesson',
    title: 'Discuss Lesson',
    article: { title: 'Test Article', paragraphs: [{ id: 'p1', text: 'Sample text.' }] },
    readingSteps: [
      {
        idx: 1,
        label: 'Task 1',
        strategy: 'quiz',
        answerKey: { type: 'quiz', answers: [{ questionIdx: 0, correct: 0, questionText: 'Q?', options: ['A', 'B'] }] },
        discuss: { targetInsight: 'Main idea comprehension' },
      },
    ],
  };

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
      providers: [
        ClassroomService, ObservationService, GradingService, AiPromptBuilder, MetricsAggregator,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    service = module.get(ClassroomService);
    aiPromptBuilder = module.get(AiPromptBuilder);
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    lessonRepo = module.get(getRepositoryToken(Lesson));

    await lessonRepo.save(lessonRepo.create({
      id: 'discuss-lesson',
      title: 'Discuss Lesson',
      subject: 'English',
      gradeLevel: '7',
      manifestJson: JSON.stringify(DISCUSS_MANIFEST),
    }));

    const { code } = await service.createSession('discuss-lesson');
    session = await service.resolveSession(code);
    const joined = await service.join(session, 'DiscussStudent');
    studentId = joined.studentId;
  });

  afterAll(async () => {
    await module.close();
  });

  afterEach(() => jest.restoreAllMocks());

  it('should return quality=pass when LLM outputs pass', async () => {
    jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValueOnce(
      JSON.stringify({ reply: 'Great work!', followUpQuestion: 'What else?', quality: 'pass' }),
    );

    const result = await service.aiDiscuss(session, studentId, 1, 'probeReply', 'I think the main idea is...');

    expect(result.quality).toBe('pass');
    expect(result.reply).toBe('Great work!');
    expect(result.followUpQuestion).toBe('What else?');
  });

  it('should return quality=retry when LLM outputs retry', async () => {
    jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValueOnce(
      JSON.stringify({ reply: 'Can you try harder?', followUpQuestion: 'Look at ¶1 again.', quality: 'retry' }),
    );

    const result = await service.aiDiscuss(session, studentId, 1, 'probeReply', 'idk');

    expect(result.quality).toBe('retry');
    expect(result.reply).toBe('Can you try harder?');
    expect(result.followUpQuestion).toBe('Look at ¶1 again.');
  });

  it('should default to quality=pass when LLM omits quality key', async () => {
    jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValueOnce(
      JSON.stringify({ reply: 'Nice answer.', followUpQuestion: 'Tell me more.' }),
    );

    const result = await service.aiDiscuss(session, studentId, 1, 'probeReply', 'The text says...');

    expect(result.quality).toBe('pass');
  });

  it('should return quality=pass on callGlm failure (error fallback)', async () => {
    jest.spyOn(aiPromptBuilder, 'callGlm').mockRejectedValueOnce(new Error('API timeout'));

    const result = await service.aiDiscuss(session, studentId, 1, 'probeReply', 'anything');

    expect(result.quality).toBe('pass');
    expect(result.reply).toContain('unavailable');
    expect(result.followUpQuestion).toBeTruthy(); // fallback includes a generic follow-up
  });

  it('should return quality for followUpReply type', async () => {
    jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValueOnce(
      JSON.stringify({ reply: 'Great conclusion!', quality: 'pass' }),
    );

    const result = await service.aiDiscuss(session, studentId, 1, 'followUpReply', 'I think it means...');

    expect(result.quality).toBe('pass');
    expect(result.reply).toBe('Great conclusion!');
    expect(result.followUpQuestion).toBeUndefined();
  });

  it('should return quality=pass when LLM returns garbage quality value', async () => {
    jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValueOnce(
      JSON.stringify({ reply: 'Ok.', followUpQuestion: 'Next?', quality: 'maybe' }),
    );

    const result = await service.aiDiscuss(session, studentId, 1, 'probeReply', 'test');

    expect(result.quality).toBe('pass');
  });

  it('should parse all fields correctly from JSON response', async () => {
    jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValueOnce(
      JSON.stringify({ reply: 'Your answer is thoughtful.', followUpQuestion: 'What about ¶2?', quality: 'retry' }),
    );

    const result = await service.aiDiscuss(session, studentId, 1, 'probeReply', 'some answer');

    expect(result.reply).toBe('Your answer is thoughtful.');
    expect(result.followUpQuestion).toBe('What about ¶2?');
    expect(result.quality).toBe('retry');
  });

  it('should repair broken JSON via LLM fallback', async () => {
    const spy = jest.spyOn(aiPromptBuilder, 'callGlm');
    // First call: primary discuss → returns broken JSON
    spy.mockResolvedValueOnce('Here is my reply: great job! Quality: pass');
    // Second call: repair → returns valid JSON
    spy.mockResolvedValueOnce(
      JSON.stringify({ reply: 'great job!', followUpQuestion: 'What else?', quality: 'pass' }),
    );

    const result = await service.aiDiscuss(session, studentId, 1, 'probeReply', 'test');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.reply).toBe('great job!');
    expect(result.followUpQuestion).toBe('What else?');
    expect(result.quality).toBe('pass');
  });

  it('should fall back to raw text with quality=pass when repair also fails', async () => {
    const spy = jest.spyOn(aiPromptBuilder, 'callGlm');
    // First call: primary discuss → broken
    spy.mockResolvedValueOnce('totally garbled output');
    // Second call: repair → also fails
    spy.mockRejectedValueOnce(new Error('API down'));

    const result = await service.aiDiscuss(session, studentId, 1, 'probeReply', 'test');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.reply).toBe('totally garbled output');
    expect(result.quality).toBe('pass');
  });
});

// ── Personal Touch + Bonus ──────────────────────────────────────────────────

const BONUS_MANIFEST = {
  id: 'bonus-lesson',
  title: 'Bonus Lesson',
  readingSteps: [
    {
      idx: 1, type: 'task', label: 'Quiz', strategy: 'quiz',
      answerKey: { type: 'quiz', answers: [{ questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] }] },
    },
    {
      idx: 3, type: 'task', label: 'Match', strategy: 'match',
      answerKey: { type: 'match', options: ['a', 'b'], answers: [{ pairIdx: 0, left: 'X', correct: 'a' }, { pairIdx: 1, left: 'Y', correct: 'b' }] },
    },
    {
      idx: 5, type: 'task', label: 'Matrix', strategy: 'matrix',
      answerKey: { type: 'matrix', answers: [{ rowIdx: 0, place: 'JP', practice: 'p', reason: 'r', isDemo: false }] },
    },
    {
      idx: 7, type: 'task', label: 'Stance', strategy: 'stance',
      answerKey: { type: 'stance', validPositions: ['agree', 'disagree'], minEvidence: 1, stanceOpts: ['agree', 'disagree'], evidence: ['e1'] },
    },
  ],
  personalTouch: {
    strategyLabels: [
      { taskIdx: 1, strategy: 'Predicting', emoji: '🔮' },
      { taskIdx: 2, strategy: 'Skimming', emoji: '👁' },
      { taskIdx: 3, strategy: 'Scanning', emoji: '🎯' },
      { taskIdx: 4, strategy: 'Evaluating', emoji: '⚖️' },
    ],
    tiers: [
      { minScore: 85, label: '策略达人', labelEn: 'Strategy Master', tone: 'gold' },
      { minScore: 60, label: '进步可期', labelEn: 'Getting There', tone: 'blue' },
      { minScore: 0, label: '继续加油', labelEn: 'Keep Practicing', tone: 'neutral' },
    ],
  },
  bonusArticle: {
    title: 'Test Bonus Article',
    paragraphs: [
      { id: 'bp1', text: 'Intro text.', role: 'introduction' },
      { id: 'bp2', text: 'Example text.', role: 'example' },
    ],
  },
  bonusSteps: [
    {
      idx: 101, type: 'task', label: '结构识别', labelEn: 'Structure ID', strategy: 'Skimming',
      answerKey: {
        type: 'match', options: ['Introduction', 'Example'],
        answers: [{ pairIdx: 0, left: 'P1', correct: 'Introduction' }, { pairIdx: 1, left: 'P2', correct: 'Example' }],
      },
    },
    {
      idx: 102, type: 'task', label: '矩阵构建', labelEn: 'Matrix Build', strategy: 'Scanning',
      answerKey: {
        type: 'matrix',
        answers: [
          { rowIdx: 0, place: 'Japan', practice: 'slurp', reason: 'respect', isDemo: true },
          { rowIdx: 1, place: 'India', practice: 'hands', reason: 'sensory', isDemo: false },
        ],
      },
    },
  ],
};

describe('ClassroomService — Personal Touch & Bonus', () => {
  let module: TestingModule;
  let service: ClassroomService;
  let sessionRepo: Repository<ClassroomSession>;
  let studentRepo: Repository<Student>;
  let submissionRepo: Repository<Submission>;
  let lessonRepo: Repository<Lesson>;
  let aiPromptBuilder: AiPromptBuilder;

  let session: ClassroomSession;
  let studentId: string;

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
      providers: [
        ClassroomService, ObservationService, GradingService, AiPromptBuilder, MetricsAggregator,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    service = module.get(ClassroomService);
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    studentRepo = module.get(getRepositoryToken(Student));
    submissionRepo = module.get(getRepositoryToken(Submission));
    lessonRepo = module.get(getRepositoryToken(Lesson));
    aiPromptBuilder = module.get(AiPromptBuilder);

    await lessonRepo.save(lessonRepo.create({
      id: 'bonus-lesson',
      title: 'Bonus Lesson',
      subject: 'English',
      gradeLevel: '7',
      manifestJson: JSON.stringify(BONUS_MANIFEST),
    }));

    const created = await service.createSession('bonus-lesson');
    session = await sessionRepo.findOne({ where: { id: created.sessionId } });
    const joined = await service.join(session!, 'BonusStudent');
    studentId = joined.studentId;
  });

  afterAll(async () => {
    await module.close();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('getPersonalTouch', () => {
    it('should return strategies, tier, aiComment, and bonusUnlocked', async () => {
      // Submit task 1 with perfect score
      await service.submit(session, studentId, 1, { answers: [1] });

      jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValueOnce('你做得很好！');

      const result = await service.getPersonalTouch(session, studentId);

      expect(result.strategies).toBeDefined();
      expect(result.strategies.length).toBeGreaterThan(0);
      expect(result.strategies[0]).toHaveProperty('task');
      expect(result.strategies[0]).toHaveProperty('strategy');
      expect(result.strategies[0]).toHaveProperty('score');
      expect(result.tier).toHaveProperty('tone');
      expect(result.aiComment).toBe('你做得很好！');
      expect(typeof result.bonusUnlocked).toBe('boolean');
    });

    it('should unlock bonus when teacher currentStep < 5', async () => {
      jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValueOnce('Great!');
      // Session currentStep defaults to 0 (teacher hasn't advanced)
      const result = await service.getPersonalTouch(session, studentId);
      expect(result.bonusUnlocked).toBe(true);
    });

    it('should NOT unlock bonus when teacher currentStep >= 5', async () => {
      jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValueOnce('Great!');
      // Advance teacher step
      await sessionRepo.update(session.id, { currentStep: 5 });
      const result = await service.getPersonalTouch(session, studentId);
      expect(result.bonusUnlocked).toBe(false);
      // Reset
      await sessionRepo.update(session.id, { currentStep: 0 });
    });

    it('should fallback gracefully when AI call fails', async () => {
      jest.spyOn(aiPromptBuilder, 'callGlm').mockRejectedValueOnce(new Error('API down'));
      const result = await service.getPersonalTouch(session, studentId);
      expect(result.aiComment).toContain('继续保持');
    });

    it('should throw NotFoundException for invalid studentId', async () => {
      jest.spyOn(aiPromptBuilder, 'callGlm').mockResolvedValueOnce('x');
      await expect(service.getPersonalTouch(session, 'nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBonusExercise', () => {
    it('should return sanitized exercise spec + article for step 1', async () => {
      const result = await service.getBonusExercise(session, 1);

      expect(result.exercise).toBeDefined();
      expect(result.exercise.type).toBe('match');
      // Sanitized: should have pairs (student-safe) but no "correct" answers
      expect(result.exercise.pairs).toBeDefined();
      expect(result.article).not.toBeNull();
      expect(result.article!.title).toBe('Test Bonus Article');
      expect(result.label).toBe('Structure ID');
      expect(result.strategy).toBe('Skimming');
    });

    it('should return matrix exercise for step 2', async () => {
      const result = await service.getBonusExercise(session, 2);

      expect(result.exercise).toBeDefined();
      expect(result.exercise.type).toBe('matrix');
      expect(result.label).toBe('Matrix Build');
      expect(result.strategy).toBe('Scanning');
    });

    it('should strip correct answers from sanitized exercise spec', async () => {
      const result = await service.getBonusExercise(session, 1);
      // Match pairs should not expose the correct answer
      const pairs = result.exercise.pairs as Array<Record<string, unknown>>;
      expect(pairs.every((p) => !('correct' in p))).toBe(true);
    });

    it('should throw BadRequestException for invalid bonusStep', async () => {
      await expect(service.getBonusExercise(session, 0)).rejects.toThrow(BadRequestException);
      await expect(service.getBonusExercise(session, 3)).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkBonusAnswer', () => {
    it('should grade a correct match answer and return allCorrect=true', async () => {
      const data = { pairs: ['Introduction', 'Example'] };
      const result = await service.checkBonusAnswer(session, studentId, 1, data);

      expect(result.type).toBe('match');
      expect(result.allCorrect).toBe(true);
      expect(result.items).toBeDefined();
    });

    it('should grade an incorrect match answer and return allCorrect=false', async () => {
      const data = { pairs: ['Example', 'Introduction'] };
      const result = await service.checkBonusAnswer(session, studentId, 1, data);

      expect(result.type).toBe('match');
      expect(result.allCorrect).toBe(false);
      expect(result.items.some((i: any) => i.correct === false)).toBe(true);
    });

    it('should persist bonus submission with virtual step 101', async () => {
      const data = { pairs: ['Introduction', 'Example'] };
      await service.checkBonusAnswer(session, studentId, 1, data);

      const sub = await submissionRepo.findOne({
        where: { sessionId: session.id, studentId, step: 101 },
      });
      expect(sub).not.toBeNull();
      expect(sub!.scoreJson).toBeDefined();
    });

    it('should update existing submission on resubmit', async () => {
      const data1 = { pairs: ['Example', 'Example'] };
      await service.checkBonusAnswer(session, studentId, 1, data1);
      const sub1 = await submissionRepo.findOne({
        where: { sessionId: session.id, studentId, step: 101 },
      });

      const data2 = { pairs: ['Introduction', 'Example'] };
      await service.checkBonusAnswer(session, studentId, 1, data2);
      const sub2 = await submissionRepo.findOne({
        where: { sessionId: session.id, studentId, step: 101 },
      });

      // Same row, updated data
      expect(sub1!.id).toBe(sub2!.id);
      expect(sub2!.scoreJson.total).toBe(100);
    });

    it('should throw BadRequestException for out-of-range bonusStep', async () => {
      await expect(service.checkBonusAnswer(session, studentId, 0, {})).rejects.toThrow(BadRequestException);
      await expect(service.checkBonusAnswer(session, studentId, 99, {})).rejects.toThrow(BadRequestException);
    });

    it('should grade a correct matrix bonus exercise (step 2)', async () => {
      // rowIdx=0 is demo (skipped), rowIdx=1 is the gradeable row
      const data = { rows: [{}, { place: 'India', practice: 'hands', reason: 'sensory' }] };
      const result = await service.checkBonusAnswer(session, studentId, 2, data);

      expect(result.type).toBe('matrix');
      expect(result.allCorrect).toBe(true);

      // Persisted with virtual step 102
      const sub = await submissionRepo.findOne({
        where: { sessionId: session.id, studentId, step: 102 },
      });
      expect(sub).not.toBeNull();
      expect(sub!.scoreJson.total).toBe(100);
    });

    it('should throw NotFoundException for invalid studentId', async () => {
      await expect(service.checkBonusAnswer(session, 'bad-id', 1, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPersonalTouch — invalid manifest', () => {
    it('should return empty fallback when manifest lacks personalTouch config', async () => {
      // Create a lesson without personalTouch
      const noTouchManifest = { ...BONUS_MANIFEST, id: 'no-touch-lesson', personalTouch: undefined };
      await lessonRepo.save(lessonRepo.create({
        id: 'no-touch-lesson',
        title: 'No Touch Lesson',
        subject: 'English',
        gradeLevel: '7',
        manifestJson: JSON.stringify(noTouchManifest),
      }));
      const created = await service.createSession('no-touch-lesson');
      const noTouchSession = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const joined = await service.join(noTouchSession!, 'NoTouchStudent');

      const result = await service.getPersonalTouch(noTouchSession!, joined.studentId);

      expect(result.strategies).toEqual([]);
      expect(result.tier.tone).toBe('neutral');
      expect(result.bonusUnlocked).toBe(false);
    });
  });
});
