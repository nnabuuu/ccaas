import { LLM_PORT } from '../../domain/ports/llm.port';
import { DISCUSS_HIGHLIGHT_REPO_PORT } from "../../domain/ports/discuss-highlight-repo.port";
import { TypeOrmDiscussHighlightRepository } from "../../adapters/persistence/repositories/discuss-highlight.repository";
import { DISCUSS_TARGET_HIT_REPO_PORT } from "../../domain/ports/discuss-target-hit-repo.port";
import { TypeOrmDiscussTargetHitRepository } from "../../adapters/persistence/repositories/discuss-target-hit.repository";
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryModule } from '@nestjs/core';
import { PLUGIN_PROVIDERS } from '../../application/exercise/test-utils';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { ClassroomController } from '../../adapters/http/classroom.controller';
import { ExerciseController } from '../../adapters/http/exercise.controller';
import { ClassroomService } from '../../application/classroom/classroom.service';
import { ClassroomBroadcastService } from '../../adapters/transport/classroom-broadcast.service';
import { ClassroomStateService } from '../../application/classroom/classroom-state.service';
import { StudentSubmissionService } from '../../application/classroom/student-submission.service';
import { ExerciseService } from '../../application/exercise/exercise.service';
import { DiscussService } from '../../application/ai/discuss.service';
import { AiAskService } from '../../application/ai/ai-ask.service';
import { PersonalizationService } from '../../application/ai/personalization.service';
import { OBSERVATION_RECORD_REPO_PORT } from '../../domain/ports/observation-record-repo.port';
import { TypeOrmObservationRecordRepository } from '../../adapters/persistence/repositories/observation-record.repository';
import { ObservationQueryService } from '../../application/observation/observation-query.service';
import { ObserveRegistry } from '../../application/observation/observe-registry';
import { QuizObserveHandler } from '../../domain/exercise-types/quiz/quiz.observe';
import { SelectEvidenceObserveHandler } from '../../domain/exercise-types/select-evidence/select-evidence.observe';
import { MapObserveHandler } from '../../domain/exercise-types/map/map.observe';
import { MatrixObserveHandler } from '../../domain/exercise-types/matrix/matrix.observe';
import { DiscussObserveHandler } from '../../application/observation/discuss.observe';
import { GradingService } from '../../application/exercise/grading.service';
import { AiPromptBuilder } from '../../application/ai/ai-prompt-builder';
import { MetricsAggregator } from '../../domain/classroom/metrics-aggregator';
import { ClusterClassifier } from '../../domain/classroom/cluster-classifier';
import { ClusterAggregator } from '../../application/discussion/cluster-aggregator';
import { CoachingService } from '../../application/observation/coaching.service';
import { DepthRankingService } from '../../application/observation/depth-ranking.service';
import { ManifestCacheService } from '../../application/classroom/manifest-cache.service';
import { StateCacheService } from '../../adapters/transport/state-cache.service';
import { TranslateService } from '../../application/ai/translate.service';
import { Student } from '../../adapters/persistence/entities/student.entity';
import { Submission } from '../../adapters/persistence/entities/submission.entity';
import { ClassroomSession } from '../../adapters/persistence/entities/classroom-session.entity';
import { AiQuestion } from '../../adapters/persistence/entities/ai-question.entity';
import { ChatMessage } from '../../adapters/persistence/entities/chat-message.entity';
import { ClassroomSnapshot } from '../../adapters/persistence/entities/classroom-snapshot.entity';
import { Lesson } from '../../adapters/persistence/entities/lesson.entity';
import { DiscussHighlight } from '../../adapters/persistence/entities/discuss-highlight.entity';
import { DiscussTargetHit } from '../../adapters/persistence/entities/discuss-target-hit.entity';
import { CacheModule } from '@nestjs/cache-manager';
import { OBSERVER_ENGINE } from '@kedge-agentic/observer-engine';

const mockObserverEngine = {
  dispatch: jest.fn().mockResolvedValue(undefined),
  setSessionMeta: jest.fn(),
  clearSessionMeta: jest.fn(),
  register: jest.fn(),
};

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

import { ObservationRecord, ObserverEventRecord } from '@kedge-agentic/observer-engine';

const ALL_ENTITIES = [
  Lesson, Student, Submission, ClassroomSession,
  AiQuestion, ChatMessage, ClassroomSnapshot,
  ObservationRecord, ObserverEventRecord,
  DiscussHighlight, DiscussTargetHit,
];

describe('Classroom polling — HTTP integration', () => {
  let app: INestApplication;
  let lessonRepo: Repository<Lesson>;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        DiscoveryModule,
        DiscoveryModule,
        CacheModule.register(),
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: ALL_ENTITIES,
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature(ALL_ENTITIES),
      ],
      controllers: [ClassroomController, ExerciseController],
      providers: [
        { provide: LLM_PORT, useExisting: AiPromptBuilder },
        TypeOrmDiscussTargetHitRepository,
        TypeOrmDiscussHighlightRepository,
        { provide: DISCUSS_HIGHLIGHT_REPO_PORT, useExisting: TypeOrmDiscussHighlightRepository },
        { provide: DISCUSS_TARGET_HIT_REPO_PORT, useExisting: TypeOrmDiscussTargetHitRepository },
        TypeOrmObservationRecordRepository,
        { provide: OBSERVATION_RECORD_REPO_PORT, useExisting: TypeOrmObservationRecordRepository },
        ...PLUGIN_PROVIDERS,
        ClassroomService, ClassroomBroadcastService, ClassroomStateService, StudentSubmissionService, ExerciseService,
        DiscussService, AiAskService, PersonalizationService,
        ObservationQueryService, ObserveRegistry, QuizObserveHandler, SelectEvidenceObserveHandler,
        MapObserveHandler, MatrixObserveHandler, DiscussObserveHandler, GradingService,
        AiPromptBuilder, MetricsAggregator, ClusterClassifier,
        ClusterAggregator, CoachingService, DepthRankingService, ManifestCacheService, StateCacheService, TranslateService,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    lessonRepo = moduleRef.get(getRepositoryToken(Lesson));
    await lessonRepo.save(
      lessonRepo.create({
        id: 'test-lesson',
        title: 'Test Lesson',
        subject: 'English',
        gradeLevel: '7',
        manifestJson: JSON.stringify(TEST_MANIFEST),
      }),
    );
    await lessonRepo.save(
      lessonRepo.create({
        id: 'full-lesson',
        title: 'Full Test Lesson',
        subject: 'English',
        gradeLevel: '7',
        manifestJson: JSON.stringify(FULL_MANIFEST),
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Helper ──
  const server = () => app.getHttpServer();

  async function createSession(): Promise<{ sessionId: string; code: string }> {
    const res = await request(server())
      .post('/classroom/sessions')
      .send({ lessonId: 'test-lesson' })
      .expect(201);
    return res.body;
  }

  async function joinStudent(code: string, name: string): Promise<{ studentId: string }> {
    const res = await request(server())
      .post(`/classroom/${code}/join`)
      .send({ name })
      .expect(201);
    return res.body;
  }

  async function createFullSession(): Promise<{ sessionId: string; code: string }> {
    const res = await request(server())
      .post('/classroom/sessions')
      .send({ lessonId: 'full-lesson' })
      .expect(201);
    return res.body;
  }

  async function startSession(code: string): Promise<void> {
    await request(server()).post(`/classroom/sessions/${code}/start`).expect(201);
  }

  async function endSession(code: string): Promise<void> {
    await request(server()).post(`/classroom/sessions/${code}/end`).expect(201);
  }

  async function submitAnswer(code: string, studentId: string, step: number, data: Record<string, unknown>) {
    const res = await request(server())
      .post(`/classroom/${code}/submit`)
      .send({ studentId, step, data })
      .expect(201);
    return res.body;
  }

  async function reportPhase(code: string, studentId: string, task: number, phase: string): Promise<void> {
    await request(server())
      .post(`/classroom/${code}/phase`)
      .send({ studentId, task, phase })
      .expect(201);
  }

  async function pollStudentStatus(code: string) {
    const res = await request(server()).get(`/classroom/sessions/${code}`).expect(200);
    return res.body;
  }

  async function pollTeacherState(code: string) {
    const res = await request(server()).get(`/classroom/${code}/state`).expect(200);
    return res.body;
  }

  // ════════════════════════════════════════════════════
  // Student polling — HTTP
  // ════════════════════════════════════════════════════

  describe('Student polling — HTTP', () => {
    it('H1: POST /classroom/sessions → 201, returns code', async () => {
      const res = await request(server())
        .post('/classroom/sessions')
        .send({ lessonId: 'test-lesson' })
        .expect(201);

      expect(res.body.sessionId).toBeDefined();
      expect(res.body.code).toHaveLength(6);
      expect(res.body.status).toBe('waiting');
    });

    it('H2: GET /classroom/sessions/:code → 200, status=waiting', async () => {
      const { code } = await createSession();
      const res = await request(server())
        .get(`/classroom/sessions/${code}`)
        .expect(200);

      expect(res.body.status).toBe('waiting');
      expect(res.body.code).toBe(code);
    });

    it('H3: POST /classroom/sessions/:code/start → 200', async () => {
      const { code } = await createSession();
      const res = await request(server())
        .post(`/classroom/sessions/${code}/start`)
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBe('active');
    });

    it('H4: GET /classroom/sessions/:code → 200, status=active after start', async () => {
      const { code } = await createSession();
      await request(server()).post(`/classroom/sessions/${code}/start`).expect(201);

      const res = await request(server())
        .get(`/classroom/sessions/${code}`)
        .expect(200);

      expect(res.body.status).toBe('active');
    });

    it('H5: POST /classroom/sessions/:code/end → 200', async () => {
      const { code } = await createSession();
      await request(server()).post(`/classroom/sessions/${code}/start`).expect(201);

      const res = await request(server())
        .post(`/classroom/sessions/${code}/end`)
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBe('ended');
    });

    it('H6: GET /classroom/sessions/:code → 200, status=ended after end', async () => {
      const { code } = await createSession();
      await request(server()).post(`/classroom/sessions/${code}/start`).expect(201);
      await request(server()).post(`/classroom/sessions/${code}/end`).expect(201);

      const res = await request(server())
        .get(`/classroom/sessions/${code}`)
        .expect(200);

      expect(res.body.status).toBe('ended');
    });

    it('H7: GET /classroom/sessions/INVALID → 400 (bad code format)', async () => {
      await request(server())
        .get('/classroom/sessions/bad!!')
        .expect(400);
    });

    it('H8: GET /classroom/sessions/ZZZZZZ → 404 (not found)', async () => {
      await request(server())
        .get('/classroom/sessions/ZZZZZZ')
        .expect(404);
    });
  });

  // ════════════════════════════════════════════════════
  // Teacher polling — HTTP
  // ════════════════════════════════════════════════════

  describe('Teacher polling — HTTP', () => {
    it('H9: GET /classroom/:code/state → 200, full ClassroomState', async () => {
      const { code } = await createSession();
      const res = await request(server())
        .get(`/classroom/${code}/state`)
        .expect(200);

      expect(res.body).toHaveProperty('students');
      expect(res.body).toHaveProperty('metrics');
      expect(res.body).toHaveProperty('activeNotifications');
      expect(res.body).toHaveProperty('stepMetrics');
    });

    it('H10: POST /:code/join → then GET /state → students.length=1', async () => {
      const { code } = await createSession();
      await joinStudent(code, '张三');

      const res = await request(server())
        .get(`/classroom/${code}/state`)
        .expect(200);

      expect(res.body.students).toHaveLength(1);
      expect(res.body.students[0].name).toBe('张三');
    });

    it('H11: POST /:code/notify → then GET /state → activeNotifications', async () => {
      const { code } = await createSession();
      // Must start session first — notify requires active session
      await request(server()).post(`/classroom/sessions/${code}/start`).expect(201);

      await request(server())
        .post(`/classroom/${code}/notify`)
        .send({ message: '注意看黑板', type: 'general' })
        .expect(201);

      const res = await request(server())
        .get(`/classroom/${code}/state`)
        .expect(200);

      expect(res.body.activeNotifications).toHaveLength(1);
      expect(res.body.activeNotifications[0].message).toBe('注意看黑板');
    });

    it('H12: GET /classroom/bad!!/state → 400', async () => {
      await request(server())
        .get('/classroom/bad!!/state')
        .expect(400);
    });
  });

  // ════════════════════════════════════════════════════
  // Full polling flow — HTTP
  // ════════════════════════════════════════════════════

  describe('Full polling flow — HTTP', () => {
    it('H13: complete lifecycle simulating REST polling', async () => {
      // 1. Create session
      const { code } = await createSession();

      // 2. Student joins
      const { studentId } = await joinStudent(code, '小明');

      // 3. Student polls: waiting
      let poll = await request(server()).get(`/classroom/sessions/${code}`).expect(200);
      expect(poll.body.status).toBe('waiting');

      // 4. Teacher starts
      await request(server()).post(`/classroom/sessions/${code}/start`).expect(201);

      // 5. Student polls: active
      poll = await request(server()).get(`/classroom/sessions/${code}`).expect(200);
      expect(poll.body.status).toBe('active');

      // 6. Student submits
      await request(server())
        .post(`/classroom/${code}/submit`)
        .send({ studentId, step: 1, data: { answers: [1, 0] } })
        .expect(201);

      // 7. Teacher polls: sees submission
      let state = await request(server()).get(`/classroom/${code}/state`).expect(200);
      const student = state.body.students.find((s: any) => s.id === studentId);
      expect(student.submissions[1]).toBeDefined();
      expect(student.submissions[1].score.total).toBe(100);

      // 8. Teacher notifies
      await request(server())
        .post(`/classroom/${code}/notify`)
        .send({ message: '做得好！', type: 'general' })
        .expect(201);

      // 9. Teacher polls: sees notification
      state = await request(server()).get(`/classroom/${code}/state`).expect(200);
      expect(state.body.activeNotifications).toHaveLength(1);
      expect(state.body.activeNotifications[0].message).toBe('做得好！');

      // 10. Teacher ends session
      await request(server()).post(`/classroom/sessions/${code}/end`).expect(201);

      // 11. Student polls: ended
      poll = await request(server()).get(`/classroom/sessions/${code}`).expect(200);
      expect(poll.body.status).toBe('ended');
    });
  });

  // ════════════════════════════════════════════════════
  // Student journey — HTTP (full-lesson, 5 tasks)
  // ════════════════════════════════════════════════════

  describe('Student journey — HTTP', () => {
    let code: string;
    let studentId: string;

    beforeAll(async () => {
      ({ code } = await createFullSession());
    });

    it('J1: join waiting room', async () => {
      const res = await request(server())
        .post(`/classroom/${code}/join`)
        .send({ name: '学生A' })
        .expect(201);

      studentId = res.body.studentId;
      expect(studentId).toBeDefined();
      expect(res.body.name).toBe('学生A');
      expect(res.body.lessonId).toBe('full-lesson');
    });

    it('J2: poll while waiting', async () => {
      const poll = await pollStudentStatus(code);
      expect(poll.status).toBe('waiting');
    });

    it('J3: poll after teacher starts', async () => {
      await startSession(code);
      const poll = await pollStudentStatus(code);
      expect(poll.status).toBe('active');
    });

    it('J4: get exercise spec — has questions, no correct', async () => {
      const res = await request(server())
        .get(`/classroom/${code}/steps/1/exercise`)
        .expect(200);

      expect(res.body.type).toBe('quiz');
      expect(res.body.questions).toHaveLength(2);
      // Student-safe: no correct field exposed
      for (const q of res.body.questions) {
        expect(q.correct).toBeUndefined();
      }
    });

    it('J5: check with wrong answer → allCorrect=false', async () => {
      const res = await request(server())
        .post(`/classroom/${code}/steps/1/check`)
        .send({ studentId, data: { answers: [0, 1] } })
        .expect(201);

      expect(res.body.allCorrect).toBe(false);
      expect(res.body.type).toBe('quiz');
    });

    it('J6: check with correct answer → allCorrect=true', async () => {
      const res = await request(server())
        .post(`/classroom/${code}/steps/1/check`)
        .send({ studentId, data: { answers: [1, 0] } })
        .expect(201);

      expect(res.body.allCorrect).toBe(true);
    });

    it('J7: submit correct answer → score.total=100', async () => {
      const result = await submitAnswer(code, studentId, 1, { answers: [1, 0] });
      expect(result.ok).toBe(true);
      expect(result.score.total).toBe(100);
    });

    it('J8: report phase → 201', async () => {
      await reportPhase(code, studentId, 1, 'discuss');
    });

    it('J9: get progress?include=submissions → flat fields + submissions', async () => {
      const res = await request(server())
        .get(`/classroom/${code}/students/${studentId}/progress?include=submissions`)
        .expect(200);

      expect(res.body.currentTask).toBeDefined();
      expect(res.body.currentPhase).toBeDefined();
      expect(res.body.submissions).toBeDefined();
      expect(res.body.submissions[1]).toBeDefined();
    });

    it('J10: get single step submission → data, score, submittedAt', async () => {
      const res = await request(server())
        .get(`/classroom/${code}/students/${studentId}/submissions/1`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.score).toBeDefined();
      expect(res.body.submittedAt).toBeDefined();
    });

    it('J11: poll after session ended → status=ended', async () => {
      await endSession(code);
      const poll = await pollStudentStatus(code);
      expect(poll.status).toBe('ended');
    });

    it('J12: submit after ended → 400', async () => {
      await request(server())
        .post(`/classroom/${code}/submit`)
        .send({ studentId, step: 1, data: { answers: [1, 0] } })
        .expect(400);
    });
  });

  // ════════════════════════════════════════════════════
  // Teacher dashboard journey — HTTP
  // ════════════════════════════════════════════════════

  describe('Teacher dashboard journey — HTTP', () => {
    let code: string;
    let studentIds: string[];

    beforeAll(async () => {
      ({ code } = await createFullSession());
      studentIds = [];
    });

    it('D1: empty classroom state', async () => {
      const state = await pollTeacherState(code);
      expect(state.students).toHaveLength(0);
      expect(state.metrics.total).toBe(0);
    });

    it('D2: 3 students join → students.length=3', async () => {
      for (const name of ['Alice', 'Bob', 'Charlie']) {
        const { studentId } = await joinStudent(code, name);
        studentIds.push(studentId);
      }
      const state = await pollTeacherState(code);
      expect(state.students).toHaveLength(3);
      expect(state.metrics.total).toBe(3);
    });

    it('D3: start session → status=active', async () => {
      await startSession(code);
      const poll = await pollStudentStatus(code);
      expect(poll.status).toBe('active');
    });

    it('D4: set step → currentStep changes', async () => {
      const res = await request(server())
        .post(`/classroom/${code}/step`)
        .send({ step: 2 })
        .expect(201);
      expect(res.body.ok).toBe(true);

      const state = await pollTeacherState(code);
      expect(state.currentStep).toBe(2);
    });

    it('D5: submit → stepMetrics updated, submission visible', async () => {
      // Alice submits step 1 (quiz, correct)
      await submitAnswer(code, studentIds[0], 1, { answers: [1, 0] });

      const state = await pollTeacherState(code);
      const alice = state.students.find((s: any) => s.id === studentIds[0]);
      expect(alice.submissions[1]).toBeDefined();
      expect(alice.submissions[1].score.total).toBe(100);
    });

    it('D6: multiple students at different progress', async () => {
      // Bob submits step 1 (wrong answer → lower score)
      await submitAnswer(code, studentIds[1], 1, { answers: [0, 1] });
      // Alice reports phase to task 2
      await reportPhase(code, studentIds[0], 2, 'listen');

      const state = await pollTeacherState(code);
      const alice = state.students.find((s: any) => s.id === studentIds[0]);
      const bob = state.students.find((s: any) => s.id === studentIds[1]);
      const charlie = state.students.find((s: any) => s.id === studentIds[2]);

      // Alice advanced to task 2, Bob/Charlie still at task 1
      expect(alice.currentTask).toBe(2);
      expect(bob.currentTask).toBe(1);
      expect(charlie.currentTask).toBe(1);
    });

    it('D7: send notification → activeNotifications.length=1', async () => {
      await request(server())
        .post(`/classroom/${code}/notify`)
        .send({ message: '请注意', type: 'general' })
        .expect(201);

      const state = await pollTeacherState(code);
      expect(state.activeNotifications).toHaveLength(1);
      expect(state.activeNotifications[0].message).toBe('请注意');
    });

    it('D8: revoke notification (toggle) → activeNotifications=[]', async () => {
      // Same message + type toggles the notification off
      await request(server())
        .post(`/classroom/${code}/notify`)
        .send({ message: '请注意', type: 'general' })
        .expect(201);

      const state = await pollTeacherState(code);
      expect(state.activeNotifications).toHaveLength(0);
    });

    it('D9: end session → status=ended', async () => {
      await endSession(code);
      const poll = await pollStudentStatus(code);
      expect(poll.status).toBe('ended');
    });
  });

  // ════════════════════════════════════════════════════
  // Multi-student concurrent — HTTP
  // ════════════════════════════════════════════════════

  describe('Multi-student concurrent — HTTP', () => {
    it('C1: 3 students submit different answers → independent scores', async () => {
      const { code } = await createFullSession();
      const s1 = await joinStudent(code, '甲');
      const s2 = await joinStudent(code, '乙');
      const s3 = await joinStudent(code, '丙');
      await startSession(code);

      // All correct
      const r1 = await submitAnswer(code, s1.studentId, 1, { answers: [1, 0] });
      // All wrong
      const r2 = await submitAnswer(code, s2.studentId, 1, { answers: [0, 1] });
      // Half correct
      const r3 = await submitAnswer(code, s3.studentId, 1, { answers: [1, 1] });

      expect(r1.score.total).toBe(100);
      expect(r2.score.total).toBe(0);
      expect(r3.score.total).toBe(50);

      // Teacher state aggregates correctly
      const state = await pollTeacherState(code);
      expect(state.students).toHaveLength(3);
      const scores = state.students.map((s: any) => s.submissions[1]?.score?.total);
      expect(scores.sort((a: number, b: number) => a - b)).toEqual([0, 50, 100]);
    });

    it('C2: wrong answer does not advance task, correct does', async () => {
      const { code } = await createFullSession();
      const s1 = await joinStudent(code, '快');
      const s2 = await joinStudent(code, '慢');
      await startSession(code);

      // s1 submits correct → advances
      await submitAnswer(code, s1.studentId, 1, { answers: [1, 0] });
      await reportPhase(code, s1.studentId, 2, 'listen');

      // s2 submits wrong → stays
      await submitAnswer(code, s2.studentId, 1, { answers: [0, 1] });

      const state = await pollTeacherState(code);
      const fast = state.students.find((s: any) => s.id === s1.studentId);
      const slow = state.students.find((s: any) => s.id === s2.studentId);
      expect(fast.currentTask).toBe(2);
      expect(slow.currentTask).toBe(1);
    });

    it('C3: two sessions are isolated', async () => {
      const { code: codeA } = await createFullSession();
      const { code: codeB } = await createFullSession();

      const sA = await joinStudent(codeA, '甲班');
      const sB = await joinStudent(codeB, '乙班');

      const stateA = await pollTeacherState(codeA);
      const stateB = await pollTeacherState(codeB);

      // A's student not in B
      expect(stateA.students).toHaveLength(1);
      expect(stateA.students[0].name).toBe('甲班');
      expect(stateB.students).toHaveLength(1);
      expect(stateB.students[0].name).toBe('乙班');
    });
  });

  // ════════════════════════════════════════════════════
  // Error guard — HTTP
  // ════════════════════════════════════════════════════

  describe('Error guard — HTTP', () => {
    it('E1: submit during waiting phase → 400', async () => {
      const { code } = await createFullSession();
      const { studentId } = await joinStudent(code, '测试');

      await request(server())
        .post(`/classroom/${code}/submit`)
        .send({ studentId, step: 1, data: { answers: [1, 0] } })
        .expect(400);
    });

    it('E2: join during waiting phase → 201', async () => {
      const { code } = await createFullSession();
      await request(server())
        .post(`/classroom/${code}/join`)
        .send({ name: '等待中加入' })
        .expect(201);
    });

    it('E3: join after ended → 400', async () => {
      const { code } = await createFullSession();
      await startSession(code);
      await endSession(code);

      await request(server())
        .post(`/classroom/${code}/join`)
        .send({ name: '迟到' })
        .expect(400);
    });

    it('E4: submit after ended → 400', async () => {
      const { code } = await createFullSession();
      const { studentId } = await joinStudent(code, '测试');
      await startSession(code);
      await endSession(code);

      await request(server())
        .post(`/classroom/${code}/submit`)
        .send({ studentId, step: 1, data: { answers: [1, 0] } })
        .expect(400);
    });

    it('E5: notify after ended → 400', async () => {
      const { code } = await createFullSession();
      await startSession(code);
      await endSession(code);

      await request(server())
        .post(`/classroom/${code}/notify`)
        .send({ message: '太晚了', type: 'general' })
        .expect(400);
    });

    it('E6: submit with non-existent studentId → 404', async () => {
      const { code } = await createFullSession();
      await startSession(code);

      await request(server())
        .post(`/classroom/${code}/submit`)
        .send({ studentId: '00000000-0000-0000-0000-000000000000', step: 1, data: { answers: [1, 0] } })
        .expect(404);
    });

    it('E7: submit missing required fields → 400', async () => {
      const { code } = await createFullSession();
      await startSession(code);

      // Missing studentId, step, data
      await request(server())
        .post(`/classroom/${code}/submit`)
        .send({})
        .expect(400);
    });
  });
});
