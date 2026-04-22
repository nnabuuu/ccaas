import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ClassroomService } from './classroom.service';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import { Lesson } from '../entities/lesson.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

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
          { questionIdx: 0, correct: 'B' },
          { questionIdx: 1, correct: 'A' },
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
          { questionIdx: 0, correct: 'B' },
          { questionIdx: 1, correct: 'A' },
        ],
      },
    },
    {
      idx: 3,
      label: 'Match Step',
      strategy: 'match',
      answerKey: {
        type: 'match',
        answers: [
          { pairIdx: 0, correct: 'skimming' },
          { pairIdx: 1, correct: 'scanning' },
          { pairIdx: 2, correct: 'inferring' },
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
      },
    },
    {
      idx: 9,
      label: 'Order Step',
      strategy: 'order',
      answerKey: {
        type: 'order',
        correctOrder: ['Introduction', 'Body', 'Conclusion'],
      },
    },
  ],
};

// Manifest with a step that has no answerKey
const NO_KEY_MANIFEST = {
  id: 'no-key-lesson',
  title: 'No Key Lesson',
  readingSteps: [
    { idx: 1, label: 'Reading step', strategy: 'read' },
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
    { step: 1, data: { answers: ['B', 'A'] } },
    { step: 3, data: { pairs: ['skimming', 'scanning', 'inferring'] } },
    { step: 5, data: { rows: [
      { place: 'Japan', practice: 'meditation', reason: 'focus' },
      { place: 'India', practice: 'yoga', reason: 'flexibility' },
    ] } },
    { step: 7, data: { position: 'agree', evidence: ['e1', 'e2'] } },
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
          entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, Submission, ClassroomSession, AiQuestion]),
      ],
      providers: [ClassroomService],
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
        answers: ['B', 'A'],
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

      // Verify progress advanced
      const student = await studentRepo.findOne({ where: { id: studentId } });
      expect(student!.currentTask).toBe(2);
      expect(student!.currentPhase).toBe('listen');
      expect(student!.stepStartedAt).toBeDefined();

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
      // Student advanced to task 2
      expect(state.stepMetrics[2].currentCount).toBe(1);
    });

    it('should handle re-join returning existing student with persisted progress', async () => {
      const rejoined = await service.join(session, '测试学生');
      expect(rejoined.studentId).toBe(studentId);

      // Progress should still reflect advanced state
      const student = await studentRepo.findOne({ where: { id: studentId } });
      expect(student!.currentTask).toBe(2);
    });

    it('should handle re-submit updating score', async () => {
      // Submit again with wrong answers
      const result = await service.submit(session, studentId, 1, {
        answers: ['A', 'B'],
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
      await service.submit(session!, joined.studentId, 1, { answers: ['B', 'A'] });

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
          entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, Submission, ClassroomSession, AiQuestion]),
      ],
      providers: [ClassroomService],
    }).compile();

    service = module.get(ClassroomService);
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
      await service.submit(session, idA, 1, { answers: ['B', 'A'] });

      // B submits step 1 (task 1) → task 2, then step 3 (task 2) → task 3
      await service.submit(session, idB, 1, { answers: ['B', 'A'] });
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
    it('should set currentPhase to completed when task 5 is submitted', async () => {
      const created = await service.createSession('full-lesson');
      const session = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const joined = await service.join(session!, '完成学生');
      const sid = joined.studentId;

      // Submit all 5 tasks in order
      await service.submit(session!, sid, 1, { answers: ['B', 'A'] }); // task 1→2
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
      await service.submit(session!, sid, 1, { answers: ['B', 'A'] }); // task 1→2
      await service.submit(session!, sid, 3, { pairs: ['skimming', 'scanning', 'inferring'] }); // task 2→3

      let student = await studentRepo.findOne({ where: { id: sid } });
      expect(student!.currentTask).toBe(3);

      // Re-submit step 1 (task 1) — should NOT regress to task 2
      await service.submit(session!, sid, 1, { answers: ['A', 'B'] });

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
      jest.spyOn(service as any, 'callGlm').mockResolvedValueOnce(
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
      jest.spyOn(service as any, 'callGlm').mockRejectedValueOnce(
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
        service.submit(session!, 'non-existent-student', 1, { answers: ['B', 'A'] }),
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
});
