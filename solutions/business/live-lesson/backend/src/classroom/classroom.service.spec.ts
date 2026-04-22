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
      await service.submit(session, idA, 1, { answers: ['B', 'A'] });
      await service.submit(session, idA, 3, { pairs: ['skimming', 'scanning', 'inferring'] });

      // B: submits task 1 (all wrong)
      await service.submit(session, idB, 1, { answers: ['A', 'B'] });

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

      // Task 2: only A submitted, all correct (match: p0→P1, p1→P2, p2→P3)
      const task2 = state.stepMetrics[2];
      expect(task2.byDimension['P1']).toEqual({ good: 100, partial: 0, wrong: 0 });
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

      // Complete all 5 tasks
      await service.submit(sess!, sid, 1, { answers: ['B', 'A'] });
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

      // Sorted tasks: [1, 2, 3] → median = 2
      expect(state.healthCards.median.step).toBe(2);

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
      expect(state.stepMetrics[2].currentCount).toBe(1); // B at task 2
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

      // match without left labels: p0→P1, p1→P2, p2→P3
      expect(task2.quality.cols.length).toBe(3);
      const colNames = task2.quality.cols.map((c: any) => c.name);
      expect(colNames).toContain('P1');
      expect(colNames).toContain('P2');
      expect(colNames).toContain('P3');
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
      await service.submit(session, s1, 1, { answers: ['C', 'A'] });
      // s2: Q1 wrong (chose C), Q2 correct — same wrong answer as s1
      await service.submit(session, s2, 1, { answers: ['C', 'A'] });
      // s3: Q1 wrong (chose D), Q2 wrong (chose B)
      await service.submit(session, s3, 1, { answers: ['D', 'B'] });
      // s4: all correct
      await service.submit(session, s4, 1, { answers: ['B', 'A'] });
    });

    it('should detect common wrong answers with count >= 2', async () => {
      const state = await service.getState(session.id);
      const issues = state.stepMetrics[1].issues;

      expect(issues.length).toBeGreaterThanOrEqual(1);
      // 2 students chose 'C' for Q1 (correct is 'B')
      const q1Issue = issues.find((i: string) => i.includes('Q1') && i.includes('C'));
      expect(q1Issue).toBeDefined();
      expect(q1Issue).toMatch(/^2 人/);
    });

    it('should not include wrong answers with count < 2', async () => {
      const state = await service.getState(session.id);
      const issues = state.stepMetrics[1].issues;

      // Only 1 student chose 'D' for Q1 → should not appear
      const dIssue = issues.find((i: string) => i.includes('D'));
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
        await service.submit(sess!, id, 1, { answers: ['C', 'A'] }); // Q1 wrong, Q2 correct
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
      await service.submit(sess!, sid, 1, { answers: ['B', 'A'] });

      const state = await service.getState(sess!.id);
      expect(state.stepMetrics[1].alertTag).toBeNull();
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
                    { questionIdx: 0, correct: 'B', label: 'Edem' },
                    { questionIdx: 1, correct: 'A', label: 'Media' },
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
                type: 'stance', validPositions: ['agree', 'disagree'], minEvidence: 2,
              }},
              { idx: 9, label: 'Order', strategy: 'order', answerKey: {
                type: 'order', correctOrder: ['A', 'B', 'C'],
              }},
            ],
          }),
        }),
      );

      const created = await service.createSession('labeled-lesson');
      const sess = await sessionRepo.findOne({ where: { id: created.sessionId } });
      const sid = (await service.join(sess!, 'LabelStudent')).studentId;

      // Submit quiz with partial correct
      await service.submit(sess!, sid, 1, { answers: ['B', 'B'] });

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

      await service.submit(sess!, s1, 1, { answers: ['B', 'A'] });
      await service.submit(sess!, s2, 1, { answers: ['B', 'A'] });

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

      await service.submit(sess!, s1, 1, { answers: ['B', 'A'] });

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
      await service.submit(sess!, s1, 1, { answers: ['B', 'A'] });
      await service.submit(sess!, s2, 1, { answers: ['B', 'A'] });

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
        await service.submit(sess!, sid, 1, { answers: ['C', 'A'] }); // Q1 wrong, Q2 correct
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
      await service.submit(sess!, stuckIds[0], 1, { answers: ['C', 'A'] });

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
});
