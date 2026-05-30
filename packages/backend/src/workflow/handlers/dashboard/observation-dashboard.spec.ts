/**
 * ObservationDashboardProjector tests — verifies Path B legacy-shape
 * output from platform-side ontology observations.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObservationRecord, ObserverEventRecord } from '../../entities';
import { ObservationRepository } from '../../persistence/observation-repository';
import { IndicatorRegistryService } from '../../llm/indicator-registry.service';
import { ObservationDashboardProjector } from './observation-dashboard.projector';
import { getTestDatabaseOptions } from '../../../../test/setup/test-database';

describe('ObservationDashboardProjector', () => {
  let projector: ObservationDashboardProjector;
  let repo: ObservationRepository;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature([ObservationRecord, ObserverEventRecord]),
      ],
      providers: [
        ObservationRepository,
        ObservationDashboardProjector,
        IndicatorRegistryService,
      ],
    }).compile();
    projector = module.get(ObservationDashboardProjector);
    repo = module.get(ObservationRepository);
  });

  afterEach(async () => {
    await module.close();
  });

  it('empty session → empty logs + alerts + indicatorStats + indicators', async () => {
    const result = await projector.project('tenant-a','empty-session');
    expect(result).toEqual({ logs: [], alerts: [], indicatorStats: [], indicators: [] });
  });

  it('lifecycle observations roll up into StudentLog with system events', async () => {
    await repo.append({
      id: 'obs-1',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'lifecycle',
      data: { action: 'join', classroomCode: 'HX' },
      triggerEventId: 'evt-1',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await repo.append({
      id: 'obs-2',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'lifecycle',
      data: { action: 'discuss_complete', step: 2 },
      triggerEventId: 'evt-2',
      createdAt: 2000,
      updatedAt: 2000,
    });
    const out = await projector.project('tenant-a','s1');
    expect(out.logs).toHaveLength(1);
    const log = out.logs[0];
    expect(log.studentId).toBe('student-1');
    expect(log.studentName).toBe('student-1'); // M3 placeholder
    expect(log.events).toHaveLength(2);
    expect(log.events[0]).toMatchObject({
      timestamp: 1000,
      source: 'system',
      systemType: 'join',
    });
    expect(log.events[1]).toMatchObject({
      timestamp: 2000,
      source: 'system',
      systemType: 'discuss_complete',
    });
    // pass-1 S2 fix: messageCount stays 0 until M4's chat_turn handler
    // lands. legacy dashboard counted ONLY chat_turn rows; bumping on
    // non-chat lifecycle would diverge from legacy during dual-write.
    expect(log.systemMetrics.messageCount).toBe(0);
    // M5 pass-2 S2: lifecycle doesn't count as activity (MF2) but IS a
    // fallback when no activity rows exist — gives frontend a real
    // number instead of null/NaN. Two lifecycle rows here → latest
    // (2000) wins.
    expect(log.systemMetrics.lastActiveAt).toBe(2000);
  });

  it('pass-1 N4: unknown observation type → opaque system event (forward-compat default arm)', async () => {
    await repo.append({
      id: 'obs-unknown',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'future_phase_5_type',
      data: { whatever: 'opaque' },
      triggerEventId: 'evt-u',
      createdAt: 1234,
      updatedAt: 1234,
    });
    const out = await projector.project('tenant-a','s1');
    expect(out.logs).toHaveLength(1);
    expect(out.logs[0].events).toHaveLength(1);
    expect(out.logs[0].events[0]).toMatchObject({
      timestamp: 1234,
      source: 'system',
      systemType: 'future_phase_5_type',
      data: { whatever: 'opaque' },
    });
  });

  it('exercise observation populates exerciseCorrectRate (avg) + currentStep', async () => {
    // M5 pass-1 SF3: legacy live-lesson averaged 0..100 scores; projector
    // pre-M5 last-writer-wins drifted from that. Two exercises → average.
    await repo.append({
      id: 'obs-3a',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'exercise',
      data: { step: 3, score: 80 },
      triggerEventId: 'evt-3a',
      createdAt: 1500,
      updatedAt: 1500,
    });
    await repo.append({
      id: 'obs-3b',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'exercise',
      data: { step: 3, score: 60 },
      triggerEventId: 'evt-3b',
      createdAt: 1600,
      updatedAt: 1600,
    });
    const out = await projector.project('tenant-a', 's1');
    expect(out.logs[0].systemMetrics.exerciseCorrectRate).toBe(70); // avg(80,60)
    expect(out.logs[0].systemMetrics.currentStep).toBe(3);
    expect(out.logs[0].events[0].systemType).toBe('exercise_result');
  });

  it('progress observation populates currentStep', async () => {
    await repo.append({
      id: 'obs-4',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'progress',
      data: { step: 5, taskNum: 2 },
      triggerEventId: 'evt-4',
      createdAt: 1700,
      updatedAt: 1700,
    });
    const out = await projector.project('tenant-a','s1');
    expect(out.logs[0].systemMetrics.currentStep).toBe(5);
    expect(out.logs[0].events[0].systemType).toBe('step_complete');
  });

  it('multi-student session produces one StudentLog per entityId, sorted', async () => {
    await repo.append({
      id: 'a',
      sessionId: 's1',
      entityId: 'student-zebra',
      solutionId: 'live-lesson',
      type: 'lifecycle',
      data: { action: 'join' },
      triggerEventId: 'evt-a',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await repo.append({
      id: 'b',
      sessionId: 's1',
      entityId: 'student-alpha',
      solutionId: 'live-lesson',
      type: 'lifecycle',
      data: { action: 'join' },
      triggerEventId: 'evt-b',
      createdAt: 1100,
      updatedAt: 1100,
    });
    const out = await projector.project('tenant-a','s1');
    expect(out.logs.map((l) => l.studentId)).toEqual([
      'student-alpha',
      'student-zebra',
    ]);
  });

  it('M5.3b: indicatorStats populated from IndicatorRegistry + indicator_hit rows', async () => {
    const indicators = module.get(IndicatorRegistryService);
    indicators.setIndicators('tenant-a', 's1', [
      { id: 'K1', type: 'knowledge', label: 'concept', description: 'd' },
      { id: 'M1', type: 'misconception', label: 'mix-up', description: 'd' },
    ]);
    await repo.append({
      id: 'h1',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'indicator_hit',
      data: { anchors: ['K1'], gist: 'first concept' },
      triggerEventId: 'e1',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await repo.append({
      id: 'h2',
      sessionId: 's1',
      entityId: 'student-2',
      solutionId: 'live-lesson',
      type: 'indicator_hit',
      data: { anchors: ['K1', 'M1'], gist: 'newer gist' },
      triggerEventId: 'e2',
      createdAt: 2000,
      updatedAt: 2000,
    });
    const out = await projector.project('tenant-a','s1');
    expect(out.indicatorStats).toEqual([
      {
        indicatorId: 'K1',
        label: 'concept',
        type: 'knowledge',
        studentCount: 2,
        latestGist: 'newer gist',
        updatedAt: 2000,
      },
      {
        indicatorId: 'M1',
        label: 'mix-up',
        type: 'misconception',
        studentCount: 1,
        latestGist: 'newer gist',
        updatedAt: 2000,
      },
    ]);
  });

  it('M5.3b: indicatorStats fails closed on unknown anchors (no surface)', async () => {
    const indicators = module.get(IndicatorRegistryService);
    indicators.setIndicators('tenant-a', 's1', [
      { id: 'K1', type: 'knowledge', label: 'known', description: 'd' },
    ]);
    await repo.append({
      id: 'h',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'indicator_hit',
      data: { anchors: ['K1', 'UNKNOWN_PHANTOM'], gist: 'g' },
      triggerEventId: 'e',
      createdAt: 1000,
      updatedAt: 1000,
    });
    const out = await projector.project('tenant-a','s1');
    expect(out.indicatorStats.map((s) => s.indicatorId)).toEqual(['K1']);
  });

  it('M5 pass-1 MF1: resolves studentName from join lifecycle event', async () => {
    await repo.append({
      id: 'jl',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'lifecycle',
      data: { action: 'join', studentName: 'Alice' },
      triggerEventId: 'e0',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await repo.append({
      id: 'st',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'student_status',
      data: { status: 'stuck', alertMessage: 'help' },
      triggerEventId: 'e1',
      createdAt: 2000,
      updatedAt: 2000,
    });
    const out = await projector.project('tenant-a', 's1');
    expect(out.logs[0].studentName).toBe('Alice');
    // Alert payload also picks up the resolved name.
    expect(out.alerts).toHaveLength(1);
    expect(out.alerts[0].studentName).toBe('Alice');
  });

  it('M5 pass-1 MF1: falls back to studentId when no join name', async () => {
    await repo.append({
      id: 'l',
      sessionId: 's1',
      entityId: 'student-anon',
      solutionId: 'live-lesson',
      type: 'exercise',
      data: { score: 50 },
      triggerEventId: 'e',
      createdAt: 1000,
      updatedAt: 1000,
    });
    const out = await projector.project('tenant-a', 's1');
    expect(out.logs[0].studentName).toBe('student-anon');
  });

  it('M5 pass-2 S2: lastActiveAt prefers activity over lifecycle when both exist', async () => {
    // Lifecycle at t=500, activity at t=2000 → activity wins. Lifecycle
    // is only a fallback to keep a join-only student from showing
    // null/NaN; once activity arrives it must take precedence so the
    // idle heuristic sees the real freshness.
    await repo.append({
      id: 'l',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'lifecycle',
      data: { action: 'join' },
      triggerEventId: 'e0',
      createdAt: 500,
      updatedAt: 500,
    });
    await repo.append({
      id: 'h',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'indicator_hit',
      data: { anchors: ['K1'] },
      triggerEventId: 'e1',
      createdAt: 2000,
      updatedAt: 2000,
    });
    const out = await projector.project('tenant-a', 's1');
    expect(out.logs[0].systemMetrics.lastActiveAt).toBe(2000);
  });

  it('M5 pass-1 MF2: lastActiveAt excludes student_status (heuristic stays reachable)', async () => {
    // Stale activity row at t=1000, then a fresh student_status row at
    // t=9999. lastActiveAt must reflect ONLY the activity row.
    await repo.append({
      id: 'a',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'exercise',
      data: { score: 60 },
      triggerEventId: 'e1',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await repo.append({
      id: 'st',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'student_status',
      data: { status: 'active' },
      triggerEventId: 'e2',
      createdAt: 9999,
      updatedAt: 9999,
    });
    const out = await projector.project('tenant-a', 's1');
    expect(out.logs[0].systemMetrics.lastActiveAt).toBe(1000);
  });

  it('does not include observations from other sessions', async () => {
    await repo.append({
      id: 'x',
      sessionId: 's-other',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'lifecycle',
      data: { action: 'join' },
      triggerEventId: 'evt-x',
      createdAt: 1000,
      updatedAt: 1000,
    });
    const out = await projector.project('tenant-a','s1');
    expect(out.logs).toEqual([]);
  });
});
