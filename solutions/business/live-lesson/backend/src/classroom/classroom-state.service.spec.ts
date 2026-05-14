import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassroomStateService } from './classroom-state.service';
import { ObservationQueryService } from './observation/observation-query.service';
import { MetricsAggregator } from './metrics-aggregator';
import { ClusterAggregator } from './socratic-discuss/cluster-aggregator';
import { CoachingService } from './coaching.service';
import { ManifestCacheService } from './manifest-cache.service';
import { StateCacheService } from './state-cache.service';
import { AiPromptBuilder } from './ai-prompt-builder';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ClassroomSnapshot } from '../entities/classroom-snapshot.entity';
import { Lesson } from '../entities/lesson.entity';
import { DiscussHighlight } from '../entities/discuss-highlight.entity';
import { DiscussTargetHit } from '../entities/discuss-target-hit.entity';
import { OBSERVER_ENGINE, ObservationRecord } from '@kedge-agentic/observer-engine';

const mockObserverEngine = {
  dispatch: jest.fn().mockResolvedValue(undefined),
  setSessionMeta: jest.fn(),
  clearSessionMeta: jest.fn(),
  register: jest.fn(),
};

// ──────────────────────────────────────────────────────────────
// Part 1: Unit Tests — mocked repos + services, pure in-memory logic
// ──────────────────────────────────────────────────────────────

describe('ClassroomStateService — unit (mocked deps)', () => {
  let service: ClassroomStateService;
  let mockObservationQuery: { clearSession: jest.Mock; getIndicators: jest.Mock; setIndicators: jest.Mock; getObservationDashboard: jest.Mock };
  let mockClusterAggregator: { cleanupSession: jest.Mock; getClusterStats: jest.Mock };
  let mockCoachingService: { cleanupSession: jest.Mock; getHighlights: jest.Mock; getCached: jest.Mock };

  beforeAll(async () => {
    mockObservationQuery = {
      clearSession: jest.fn(),
      getIndicators: jest.fn().mockReturnValue([]),
      setIndicators: jest.fn(),
      getObservationDashboard: jest.fn().mockResolvedValue({ logs: [], alerts: [], indicatorStats: [] }),
    };
    mockClusterAggregator = {
      cleanupSession: jest.fn(),
      getClusterStats: jest.fn().mockReturnValue([]),
    };
    mockCoachingService = {
      cleanupSession: jest.fn(),
      getHighlights: jest.fn().mockResolvedValue([]),
      getCached: jest.fn().mockReturnValue(null),
    };

    const module = await Test.createTestingModule({
      providers: [
        ClassroomStateService,
        StateCacheService,
        { provide: getRepositoryToken(Student), useValue: {} },
        { provide: getRepositoryToken(Submission), useValue: {} },
        { provide: getRepositoryToken(ClassroomSession), useValue: {} },
        { provide: getRepositoryToken(AiQuestion), useValue: {} },
        { provide: ObservationQueryService, useValue: mockObservationQuery },
        { provide: MetricsAggregator, useValue: {} },
        { provide: ClusterAggregator, useValue: mockClusterAggregator },
        { provide: CoachingService, useValue: mockCoachingService },
        { provide: ManifestCacheService, useValue: { getManifest: jest.fn().mockResolvedValue(null), invalidate: jest.fn() } },
      ],
    }).compile();

    service = module.get(ClassroomStateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear in-memory state for true test isolation
    (service as any).activeNotificationsMap.clear();
    (service as any).observeRegistryCache.clear();
  });

  // ── toggleNotification ──

  describe('toggleNotification', () => {
    it('activates a notification and returns true', () => {
      const activated = service.toggleNotification('s1', 'n1', 'hello', 'info');
      expect(activated).toBe(true);
    });

    it('revokes when toggled again and returns false', () => {
      service.toggleNotification('s2', 'n1', 'hello', 'info');
      const revoked = service.toggleNotification('s2', 'n1', 'hello', 'info');
      expect(revoked).toBe(false);
    });

    it('supports multiple notifications coexisting', () => {
      service.toggleNotification('s3', 'a', 'msg-a', 'info');
      service.toggleNotification('s3', 'b', 'msg-b', 'warn');
      const active = service.getActiveNotifications('s3');
      expect(active).toHaveLength(2);
      expect(active.map(n => n.id).sort()).toEqual(['a', 'b']);
    });

    it('isolates notifications across sessions', () => {
      service.toggleNotification('iso-1', 'x', 'm', 'info');
      service.toggleNotification('iso-2', 'y', 'm', 'info');
      expect(service.getActiveNotifications('iso-1')).toHaveLength(1);
      expect(service.getActiveNotifications('iso-2')).toHaveLength(1);
      expect(service.getActiveNotifications('iso-1')[0].id).toBe('x');
      expect(service.getActiveNotifications('iso-2')[0].id).toBe('y');
    });
  });

  // ── getActiveNotifications ──

  describe('getActiveNotifications', () => {
    it('returns [] for unknown session', () => {
      expect(service.getActiveNotifications('nonexistent')).toEqual([]);
    });

    it('returns all active notifications', () => {
      service.toggleNotification('ga-1', 'n1', 'msg1', 'info');
      service.toggleNotification('ga-1', 'n2', 'msg2', 'warn');
      const result = service.getActiveNotifications('ga-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'n1', message: 'msg1', notifyType: 'info' });
      expect(result[1]).toMatchObject({ id: 'n2', message: 'msg2', notifyType: 'warn' });
      expect(result[0].timestamp).toBeDefined();
    });
  });

  // ── clearNotifications ──

  describe('clearNotifications', () => {
    it('purges all notifications for a session', () => {
      service.toggleNotification('cl-1', 'a', 'm', 'info');
      service.toggleNotification('cl-1', 'b', 'm', 'info');
      service.clearNotifications('cl-1');
      expect(service.getActiveNotifications('cl-1')).toEqual([]);
    });
  });

  // ── cleanupSession ──

  describe('cleanupSession', () => {
    it('clears notifications and delegates to collaborators', () => {
      service.toggleNotification('cleanup-1', 'n', 'm', 'info');
      service.cleanupSession('cleanup-1', 'lesson-1');

      expect(service.getActiveNotifications('cleanup-1')).toEqual([]);
      expect(mockObservationQuery.clearSession).toHaveBeenCalledWith('cleanup-1');
      expect(mockClusterAggregator.cleanupSession).toHaveBeenCalledWith('cleanup-1');
      expect(mockCoachingService.cleanupSession).toHaveBeenCalledWith('cleanup-1');
    });

    it('removes observeRegistryCache entry for the lessonId without affecting others', () => {
      (service as any).observeRegistryCache.set('lesson-X', { someKey: {} });
      (service as any).observeRegistryCache.set('lesson-Y', { otherKey: {} });

      service.cleanupSession('cleanup-2', 'lesson-X');

      expect((service as any).observeRegistryCache.has('lesson-X')).toBe(false);
      expect((service as any).observeRegistryCache.has('lesson-Y')).toBe(true);
    });
  });
});

// ──────────────────────────────────────────────────────────────
// Part 2: Integration Tests — real SQLite, real repos + aggregators
// ──────────────────────────────────────────────────────────────

// Manifest with observations + a map step (generates surfaces)
const OBS_MANIFEST = {
  id: 'obs-lesson',
  title: 'Observation Test Lesson',
  observations: {
    M1: { id: 'M1', type: 'misconception', label: '混淆主旨与细节', description: '学生将支撑细节误认为主旨' },
    K1: { id: 'K1', type: 'knowledge', label: '识别段落主旨', description: '能识别段落主旨句' },
  },
  readingSteps: [
    {
      idx: 1,
      label: 'Quiz Step',
      strategy: 'quiz',
      answerKey: {
        type: 'quiz',
        answers: [
          { questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] },
        ],
      },
    },
    {
      idx: 3,
      label: 'Map Step',
      strategy: 'map',
      answerKey: {
        type: 'map',
        prompt: 'Place items',
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

describe('ClassroomStateService — integration (SQLite)', () => {
  let module: TestingModule;
  let service: ClassroomStateService;
  let sessionRepo: Repository<ClassroomSession>;
  let studentRepo: Repository<Student>;
  let submissionRepo: Repository<Submission>;
  let lessonRepo: Repository<Lesson>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ObservationRecord, ClassroomSnapshot, DiscussHighlight, DiscussTargetHit],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Lesson, Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ObservationRecord, ClassroomSnapshot, DiscussHighlight, DiscussTargetHit]),
      ],
      providers: [
        ClassroomStateService,
        StateCacheService,
        ObservationQueryService,
        MetricsAggregator,
        ClusterAggregator,
        CoachingService,
        ManifestCacheService,
        AiPromptBuilder,
        { provide: OBSERVER_ENGINE, useValue: mockObserverEngine },
      ],
    }).compile();

    service = module.get(ClassroomStateService);
    sessionRepo = module.get(getRepositoryToken(ClassroomSession));
    studentRepo = module.get(getRepositoryToken(Student));
    submissionRepo = module.get(getRepositoryToken(Submission));
    lessonRepo = module.get(getRepositoryToken(Lesson));

    // Seed obs-lesson
    await lessonRepo.save(
      lessonRepo.create({
        id: 'obs-lesson',
        title: 'Observation Test Lesson',
        subject: 'English',
        gradeLevel: '7',
        manifestJson: JSON.stringify(OBS_MANIFEST),
      }),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  // ── initObservation ──

  describe('initObservation', () => {
    it('sets indicators from manifest observations field', async () => {
      const sessionId = 'init-obs-1';
      await service.initObservation(sessionId, 'obs-lesson');

      const observationQuery = module.get(ObservationQueryService);
      const indicators = observationQuery.getIndicators(sessionId);
      expect(indicators).toHaveLength(2);
      expect(indicators.map(i => i.id).sort()).toEqual(['K1', 'M1']);
    });

    it('no-op when lesson does not exist', async () => {
      await expect(
        service.initObservation('init-obs-2', 'nonexistent-lesson'),
      ).resolves.toBeUndefined();

      const observationQuery = module.get(ObservationQueryService);
      expect(observationQuery.getIndicators('init-obs-2')).toEqual([]);
    });

    it('handles invalid manifestJson without throwing', async () => {
      await lessonRepo.save(
        lessonRepo.create({
          id: 'bad-manifest',
          title: 'Bad',
          subject: 'Test',
          gradeLevel: '1',
          manifestJson: '<<<invalid json>>>',
        }),
      );

      await expect(
        service.initObservation('init-obs-3', 'bad-manifest'),
      ).resolves.toBeUndefined();
    });
  });

  // ── getSurfaces ──

  describe('getSurfaces', () => {
    let sessionId: string;

    beforeAll(async () => {
      // Create a session with the obs-lesson manifest
      const session = sessionRepo.create({
        code: 'SURF01',
        lessonId: 'obs-lesson',
        status: 'active',
        currentStep: 0,
      });
      const saved = await sessionRepo.save(session);
      sessionId = saved.id;

      // Add a student
      const student = studentRepo.create({
        sessionId,
        lessonId: 'obs-lesson',
        name: '学生A',
        currentTask: 2,
        currentPhase: 'listen',
      });
      const savedStudent = await studentRepo.save(student);

      // Submit map data for step idx=3 (task 2)
      await submissionRepo.save(
        submissionRepo.create({
          sessionId,
          lessonId: 'obs-lesson',
          studentId: savedStudent.id,
          step: 3,
          phase: 'exercise',
          dataJson: {
            placements: { itemA: [0.3, 0.4], itemB: [-0.6, -0.3] },
            reasons: { itemA: 'Because of importance', itemB: 'Because of history' },
          },
          scoreJson: { total: 75, byDimension: { itemA_placed: true, itemB_placed: true } },
        }),
      );
    });

    it('returns surfaces for map step with submissions', async () => {
      const result = await service.getSurfaces(sessionId, 2);
      // Map step auto-generates reasoning + positions surfaces
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('positions');
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.positions.length).toBeGreaterThan(0);
      // Verify actual data content from seeded submission
      expect(result.reasoning[0]).toMatchObject({ studentName: '学生A' });
      expect(result.positions[0]).toMatchObject({ studentName: '学生A' });
      expect(result.positions.some((p: any) => p.itemId === 'itemA')).toBe(true);
    });

    it('throws NotFoundException for missing session', async () => {
      await expect(
        service.getSurfaces('nonexistent-session', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns {} for taskNum outside taskMap', async () => {
      const result = await service.getSurfaces(sessionId, 99);
      expect(result).toEqual({});
    });

    it('returns {} for step with no surfaces (quiz)', async () => {
      // Task 1 = quiz step idx=1 → no surfaces
      const result = await service.getSurfaces(sessionId, 1);
      expect(result).toEqual({});
    });
  });

  // ── getState ──

  describe('getState', () => {
    it('returns correct shape with empty class', async () => {
      // Fresh session with no students
      const session = await sessionRepo.save(
        sessionRepo.create({
          code: 'EMPT01',
          lessonId: 'obs-lesson',
          status: 'active',
          currentStep: 0,
        }),
      );

      const state = await service.getState(session.id);
      expect(state.sessionStatus).toBe('active');
      expect(state.currentStep).toBe(0);
      expect(state.students).toEqual([]);
      expect(state.metrics.total).toBe(0);
      expect(state.metrics.submitted).toBe(0);
      expect(state.metrics.inProgress).toBe(0);
      expect(state.activeNotifications).toEqual([]);
      expect(state.observation).toBeDefined();
      expect(state.coaching).toBeDefined();
      expect(state.stepMetrics).toBeDefined();
      expect(state.questions).toEqual([]);
      expect(state.clusterStats).toEqual({});
    });

    it('includes activeNotifications after toggleNotification', async () => {
      const session = await sessionRepo.save(
        sessionRepo.create({
          code: 'NTFY01',
          lessonId: 'obs-lesson',
          status: 'active',
          currentStep: 0,
        }),
      );

      service.toggleNotification(session.id, 'alert-1', '请注意', 'warning');

      const state = await service.getState(session.id);
      expect(state.activeNotifications).toHaveLength(1);
      expect(state.activeNotifications[0]).toMatchObject({
        id: 'alert-1',
        message: '请注意',
        notifyType: 'warning',
      });
    });
  });
});
