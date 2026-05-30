/**
 * DashboardService tests — verifies the new ontology-native payload
 * shape is correctly assembled from observation rows + the indicator
 * catalog.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObservationRecord, ObserverEventRecord } from '@kedge-agentic/backend/workflow/entities';
import { ObservationRepository } from '@kedge-agentic/backend/workflow/persistence/observation-repository';
import { IndicatorRegistryService } from '@kedge-agentic/backend/workflow/llm/indicator-registry.service';
import { DashboardService } from './dashboard.service';
import { getTestDatabaseOptions } from '../../../test/setup/test-database';

const SESSION_ID = 'sess-dashboard-test';
const TENANT = 'tenant-dashboard-test';

describe('DashboardService', () => {
  let module: TestingModule;
  let service: DashboardService;
  let repo: ObservationRepository;
  let indicators: IndicatorRegistryService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature([ObservationRecord, ObserverEventRecord]),
      ],
      providers: [DashboardService, ObservationRepository, IndicatorRegistryService],
    }).compile();
    service = module.get(DashboardService);
    repo = module.get(ObservationRepository);
    indicators = module.get(IndicatorRegistryService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('returns empty students array + empty indicators for an unused session', async () => {
    const payload = await service.buildPayload(TENANT, SESSION_ID);
    expect(payload.sessionId).toBe(SESSION_ID);
    expect(payload.students).toEqual([]);
    expect(payload.indicators).toEqual([]);
    expect(payload.generatedAt).toBeGreaterThan(0);
  });

  it('groups observations per student + sorts by studentId', async () => {
    await repo.append({
      id: 'o1',
      sessionId: SESSION_ID,
      entityId: 'student-b',
      solutionId: TENANT,
      type: 'lifecycle',
      data: { action: 'join', studentName: 'Bob' },
      triggerEventId: 'e1',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await repo.append({
      id: 'o2',
      sessionId: SESSION_ID,
      entityId: 'student-a',
      solutionId: TENANT,
      type: 'lifecycle',
      data: { action: 'join', studentName: 'Alice' },
      triggerEventId: 'e2',
      createdAt: 2000,
      updatedAt: 2000,
    });
    const payload = await service.buildPayload(TENANT, SESSION_ID);
    expect(payload.students.map((s) => s.studentId)).toEqual(['student-a', 'student-b']);
    expect(payload.students[0].studentName).toBe('Alice');
    expect(payload.students[1].studentName).toBe('Bob');
  });

  it('falls back to studentId when no join lifecycle event has a studentName', async () => {
    await repo.append({
      id: 'o1',
      sessionId: SESSION_ID,
      entityId: 'student-anon',
      solutionId: TENANT,
      type: 'exercise',
      data: { step: 1, score: 70 },
      triggerEventId: 'e1',
      createdAt: 1000,
      updatedAt: 1000,
    });
    const payload = await service.buildPayload(TENANT, SESSION_ID);
    expect(payload.students[0].studentName).toBe('student-anon');
  });

  it('exposes raw observation rows on the slice (chrono ASC)', async () => {
    await repo.append({
      id: 'late',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'indicator_hit',
      data: { anchors: ['K1'], gist: 'g' },
      triggerEventId: 'e1',
      createdAt: 3000,
      updatedAt: 3000,
    });
    await repo.append({
      id: 'early',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'lifecycle',
      data: { action: 'join', studentName: 'X' },
      triggerEventId: 'e0',
      createdAt: 1000,
      updatedAt: 1000,
    });
    const payload = await service.buildPayload(TENANT, SESSION_ID);
    const observations = payload.students[0].observations;
    expect(observations.map((o) => o.id)).toEqual(['early', 'late']);
    expect(observations[1].data).toMatchObject({ anchors: ['K1'], gist: 'g' });
  });

  it('computes student metrics: messageCount + scores + anchor counts', async () => {
    await repo.append({
      id: 'h1',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'indicator_hit',
      data: { anchors: ['K1', 'K2'] },
      triggerEventId: 'e1',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await repo.append({
      id: 'h2',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'indicator_hit',
      data: { anchors: ['M1'] },
      triggerEventId: 'e2',
      createdAt: 2000,
      updatedAt: 2000,
    });
    await repo.append({
      id: 'ex1',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'exercise',
      data: { step: 1, score: 80 },
      triggerEventId: 'e3',
      createdAt: 3000,
      updatedAt: 3000,
    });
    await repo.append({
      id: 'ex2',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'exercise',
      data: { step: 2, score: 60 },
      triggerEventId: 'e4',
      createdAt: 4000,
      updatedAt: 4000,
    });
    await repo.append({
      id: 'pr1',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'progress',
      data: { step: 3 },
      triggerEventId: 'e5',
      createdAt: 5000,
      updatedAt: 5000,
    });
    const payload = await service.buildPayload(TENANT, SESSION_ID);
    const m = payload.students[0].metrics;
    expect(m.messageCount).toBe(2);
    expect(m.knowledgeCount).toBe(2);
    expect(m.misconceptionCount).toBe(1);
    expect(m.exerciseCorrectRate).toBe(70); // avg(80, 60)
    expect(m.lastActiveAt).toBe(5000); // most recent activity row
    expect(m.currentStep).toBe(3);
  });

  it('M5 pass-2 S2: lastActiveAt falls back to lifecycle when no activity rows', async () => {
    // Join-only student must NOT have lastActiveAt = null (which would
    // break the frontend's `now - lastActiveAt > STUCK` check).
    await repo.append({
      id: 'l',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'lifecycle',
      data: { action: 'join', studentName: 'Alice' },
      triggerEventId: 'e0',
      createdAt: 1234,
      updatedAt: 1234,
    });
    const m = (await service.buildPayload(TENANT, SESSION_ID)).students[0].metrics;
    expect(m.lastActiveAt).toBe(1234);
  });

  it('M5 pass-2 S1: exerciseCorrectRate is null (not 0) when no scored exercises', async () => {
    // Distinguishes "no data yet" from "all-zero scores" so the
    // frontend can hide the metric instead of rendering misleading 0%.
    await repo.append({
      id: 'h',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'indicator_hit',
      data: { anchors: ['K1'] },
      triggerEventId: 'e',
      createdAt: 1000,
      updatedAt: 1000,
    });
    const m = (await service.buildPayload(TENANT, SESSION_ID)).students[0].metrics;
    expect(m.exerciseCorrectRate).toBeNull();
  });

  it('lastActiveAt excludes student_status (regression for pass-1 MF2)', async () => {
    const stale = 1000;
    await repo.append({
      id: 'old',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'exercise',
      data: { score: 50 },
      triggerEventId: 'e1',
      createdAt: stale,
      updatedAt: stale,
    });
    await repo.append({
      id: 'st',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'student_status',
      // updatedAt jumps when StatusChangeService rewrites this row.
      // Must NOT bump lastActiveAt — that's the whole MF2 lesson.
      data: { status: 'active', summary: '' },
      triggerEventId: 'e2',
      createdAt: 9999,
      updatedAt: 9999,
    });
    const m = (await service.buildPayload(TENANT, SESSION_ID)).students[0].metrics;
    expect(m.lastActiveAt).toBe(stale);
  });

  it('extractStatus surfaces the most recent student_status row', async () => {
    await repo.append({
      id: 'st-old',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'student_status',
      data: { status: 'active', summary: 'old' },
      triggerEventId: 'e1',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await repo.append({
      id: 'st-new',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'student_status',
      data: {
        status: 'struggling',
        previousStatus: 'active',
        summary: 'misconceptions',
        alertMessage: 'see comment',
      },
      triggerEventId: 'e2',
      createdAt: 2000,
      updatedAt: 2000,
    });
    const slice = (await service.buildPayload(TENANT, SESSION_ID)).students[0];
    expect(slice.status).toEqual({
      current: 'struggling',
      previous: 'active',
      derivedAt: 2000,
      summary: 'misconceptions',
      alertMessage: 'see comment',
    });
  });

  it('returns status: null when no student_status row exists', async () => {
    await repo.append({
      id: 'h',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT,
      type: 'indicator_hit',
      data: { anchors: ['K1'] },
      triggerEventId: 'e1',
      createdAt: 1000,
      updatedAt: 1000,
    });
    const slice = (await service.buildPayload(TENANT, SESSION_ID)).students[0];
    expect(slice.status).toBeNull();
  });

  it('surfaces session indicators from IndicatorRegistryService', async () => {
    indicators.setIndicators(TENANT, SESSION_ID, [
      { id: 'K1', type: 'knowledge', label: 'concept', description: 'desc' },
      { id: 'M1', type: 'misconception', label: 'mix-up', description: 'desc' },
    ]);
    const payload = await service.buildPayload(TENANT, SESSION_ID);
    expect(payload.indicators).toEqual([
      { id: 'K1', type: 'knowledge', label: 'concept', description: 'desc' },
      { id: 'M1', type: 'misconception', label: 'mix-up', description: 'desc' },
    ]);
  });
});
