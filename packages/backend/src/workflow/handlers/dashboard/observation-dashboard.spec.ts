/**
 * ObservationDashboardProjector tests — verifies Path B legacy-shape
 * output from platform-side ontology observations.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObservationRecord, ObserverEventRecord } from '../../entities';
import { ObservationRepository } from '../../persistence/observation-repository';
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
      providers: [ObservationRepository, ObservationDashboardProjector],
    }).compile();
    projector = module.get(ObservationDashboardProjector);
    repo = module.get(ObservationRepository);
  });

  afterEach(async () => {
    await module.close();
  });

  it('empty session → empty logs + alerts + indicatorStats', async () => {
    const result = await projector.project('empty-session');
    expect(result).toEqual({ logs: [], alerts: [], indicatorStats: [] });
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
    const out = await projector.project('s1');
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
    const out = await projector.project('s1');
    expect(out.logs).toHaveLength(1);
    expect(out.logs[0].events).toHaveLength(1);
    expect(out.logs[0].events[0]).toMatchObject({
      timestamp: 1234,
      source: 'system',
      systemType: 'future_phase_5_type',
      data: { whatever: 'opaque' },
    });
  });

  it('exercise observation populates exerciseCorrectRate + currentStep', async () => {
    await repo.append({
      id: 'obs-3',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'exercise',
      data: { step: 3, score: 0.85 },
      triggerEventId: 'evt-3',
      createdAt: 1500,
      updatedAt: 1500,
    });
    const out = await projector.project('s1');
    expect(out.logs[0].systemMetrics.exerciseCorrectRate).toBe(0.85);
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
    const out = await projector.project('s1');
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
    const out = await projector.project('s1');
    expect(out.logs.map((l) => l.studentId)).toEqual([
      'student-alpha',
      'student-zebra',
    ]);
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
    const out = await projector.project('s1');
    expect(out.logs).toEqual([]);
  });
});
