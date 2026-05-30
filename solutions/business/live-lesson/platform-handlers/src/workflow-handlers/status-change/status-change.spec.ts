/**
 * StatusChangeService tests — derives status from observations + LLM
 * (or heuristic fallback), writes student_status row, publishes alert
 * on transition to alertable status.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import { DiscoveryModule } from '@nestjs/core';
import { NotFoundException } from '@nestjs/common';
import { StatusChangeService } from './status-change.service';
import { LLM_GATEWAY, type LlmGateway } from '@kedge-agentic/backend/workflow/llm/llm-gateway';
import {
  IndicatorRegistryService,
  type IndicatorDef,
} from '@kedge-agentic/backend/workflow/llm/indicator-registry.service';
import { ManifestAccessorService } from '@kedge-agentic/backend/ontology/manifest-accessor.service';
import {
  ONTOLOGY_REGISTRY,
  OntologyRegistryProvider,
} from '@kedge-agentic/backend/ontology/ontology-registry.provider';
import { LessonSessionManifest } from '../../ontology/lesson-session.manifest';
import { SolutionsService } from '@kedge-agentic/backend/solutions/solutions.service';
import { SolutionToolkitRegistry } from '@kedge-agentic/backend/tool-caller/solution-toolkit-registry';
import { ToolCallerProxyService } from '@kedge-agentic/backend/tool-caller/tool-caller-proxy.service';
import { ObservationRecord, ObserverEventRecord } from '@kedge-agentic/backend/workflow/entities';
import { ObservationRepository } from '@kedge-agentic/backend/workflow/persistence/observation-repository';
import { WorkflowEngineService } from '@kedge-agentic/backend/workflow/workflow-engine.service';
import { WorkflowMetricsService } from '@kedge-agentic/backend/workflow/workflow-metrics.service';
import { WorkflowRegistry } from '@kedge-agentic/backend/workflow/workflow-registry';
import { SessionMetadataService } from '@kedge-agentic/backend/sessions/services/session-metadata.service';
import { getTestDatabaseOptions } from '../../../test/setup/test-database';
import { OntologyRegistry } from '@kedge-agentic/ontology';

const TENANT_UUID = 'tenant-status-change-test';
const SESSION_ID = 'sess-status-test';

class FakeSolutionsService {
  async findOne(idOrSlug: string) {
    if (idOrSlug === 'live-lesson' || idOrSlug === TENANT_UUID) {
      return { id: TENANT_UUID, slug: 'live-lesson' };
    }
    return null;
  }
}
class FakeSessionMetadataService {
  async get() {
    throw new NotFoundException('no-op');
  }
  async put() {
    return { key: '', value: null, updatedAt: new Date().toISOString() };
  }
}
class FakeLlmGateway implements LlmGateway {
  nextResult: string | Error = '{"status":"active","summary":"engaged","alertMessage":null}';
  callCount = 0;
  async chat(): Promise<string> {
    this.callCount += 1;
    if (this.nextResult instanceof Error) throw this.nextResult;
    return this.nextResult;
  }
}

const INDICATORS: IndicatorDef[] = [
  { id: 'K1', type: 'knowledge', label: 'concept', description: 'd' },
  { id: 'M1', type: 'misconception', label: 'conf', description: 'd' },
];

describe('StatusChangeService', () => {
  let module: TestingModule;
  let observations: Repository<ObservationRecord>;
  let repo: ObservationRepository;
  let indicators: IndicatorRegistryService;
  let llm: FakeLlmGateway;
  let proxy: ToolCallerProxyService;
  let publishedEvents: Array<{ sessionId: string; streamApiName: string; payload: unknown }>;

  beforeEach(async () => {
    llm = new FakeLlmGateway();
    publishedEvents = [];
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DiscoveryModule,
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature([ObservationRecord, ObserverEventRecord]),
      ],
      providers: [
        OntologyRegistryProvider,
        ManifestAccessorService,
        { provide: SessionMetadataService, useClass: FakeSessionMetadataService },
        SolutionToolkitRegistry,
        ToolCallerProxyService,
        WorkflowRegistry,
        WorkflowMetricsService,
        WorkflowEngineService,
        ObservationRepository,
        IndicatorRegistryService,
        StatusChangeService,
        { provide: SolutionsService, useClass: FakeSolutionsService },
        { provide: LLM_GATEWAY, useValue: llm },
      ],
    }).compile();
    indicators = module.get(IndicatorRegistryService);
    observations = module.get<Repository<ObservationRecord>>(
      getRepositoryToken(ObservationRecord),
    );
    repo = module.get(ObservationRepository);
    proxy = module.get(ToolCallerProxyService);
    const ontology = module.get<OntologyRegistry>(ONTOLOGY_REGISTRY);
    ontology.registerManifest(LessonSessionManifest);
    const accessor = module.get(ManifestAccessorService);
    const orig = accessor.publish.bind(accessor);
    accessor.publish = ((sId: string, stream: string, payload: unknown) => {
      publishedEvents.push({ sessionId: sId, streamApiName: stream, payload });
      return orig(sId, stream, payload);
    }) as typeof accessor.publish;
    await module.init();
  });

  afterEach(async () => {
    await module.close();
  });

  async function invoke(entityId = 'student-1', trigger = 'chat_turn'): Promise<unknown> {
    return proxy.invoke(
      {
        tool: 'workflow-actions-status.derive_student_status',
        args: { entityId, trigger, triggerEventId: 'evt-1' },
      },
      {
        sessionId: SESSION_ID,
        solutionId: TENANT_UUID,
        actingUserId: 'system',
        actingRole: 'admin',
      },
    );
  }

  it('skips when student has no observations', async () => {
    await invoke();
    const obs = await observations.find();
    expect(obs).toHaveLength(0);
  });

  it('LLM happy path: derives active status + no alert', async () => {
    indicators.setIndicators(TENANT_UUID, SESSION_ID, INDICATORS);
    await repo.append({
      id: 'obs-1',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT_UUID,
      type: 'indicator_hit',
      data: { anchors: ['K1'], gist: 'good' },
      triggerEventId: 'evt-x',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    llm.nextResult = JSON.stringify({
      status: 'active',
      summary: 'engaged',
      alertMessage: null,
    });
    await invoke();
    const status = await observations.findOne({ where: { type: 'student_status' } });
    expect(status).toBeDefined();
    expect(status!.data).toMatchObject({
      status: 'active',
      previousStatus: null,
      summary: 'engaged',
      alertMessage: null,
    });
    // active is not alertable → no alert publish
    expect(publishedEvents.filter((e) => e.streamApiName === 'student_alerts')).toHaveLength(0);
  });

  it('LLM struggling → publishes alert on student_alerts stream (urgent transition)', async () => {
    indicators.setIndicators(TENANT_UUID, SESSION_ID, INDICATORS);
    await repo.append({
      id: 'obs-1',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT_UUID,
      type: 'indicator_hit',
      data: { anchors: ['M1'] },
      triggerEventId: 'evt-x',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    llm.nextResult = JSON.stringify({
      status: 'struggling',
      summary: 'misconception',
      alertMessage: 'Multiple misconceptions',
    });
    await invoke();
    const alerts = publishedEvents.filter((e) => e.streamApiName === 'student_alerts');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].payload).toMatchObject({
      studentId: 'student-1',
      status: 'struggling',
      previousStatus: null,
      severity: 'warn',
      message: 'Multiple misconceptions',
    });
  });

  it('updates existing student_status row instead of appending', async () => {
    indicators.setIndicators(TENANT_UUID, SESSION_ID, INDICATORS);
    await repo.append({
      id: 'st-prior',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT_UUID,
      type: 'student_status',
      data: { status: 'active', summary: 'old' },
      triggerEventId: 'evt-x',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await repo.append({
      id: 'hit',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT_UUID,
      type: 'indicator_hit',
      data: { anchors: ['K1'] },
      triggerEventId: 'evt-y',
      createdAt: 2000,
      updatedAt: 2000,
    });
    llm.nextResult = JSON.stringify({
      status: 'cruising',
      summary: 'high accuracy',
      alertMessage: null,
    });
    await invoke();
    const allStatus = await observations.find({ where: { type: 'student_status' } });
    expect(allStatus).toHaveLength(1);
    expect(allStatus[0].id).toBe('st-prior');
    expect((allStatus[0].data as Record<string, unknown>).status).toBe('cruising');
  });

  it('no alert when status unchanged (active → active)', async () => {
    indicators.setIndicators(TENANT_UUID, SESSION_ID, INDICATORS);
    await repo.append({
      id: 'st-prior',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT_UUID,
      type: 'student_status',
      data: { status: 'struggling', summary: '' },
      triggerEventId: 'evt-x',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await repo.append({
      id: 'hit',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT_UUID,
      type: 'indicator_hit',
      data: {},
      triggerEventId: 'evt-y',
      createdAt: 2000,
      updatedAt: 2000,
    });
    llm.nextResult = JSON.stringify({
      status: 'struggling',
      summary: 's',
      alertMessage: null,
    });
    await invoke();
    const alerts = publishedEvents.filter((e) => e.streamApiName === 'student_alerts');
    // status unchanged → no transition → no alert
    expect(alerts).toHaveLength(0);
  });

  it('heuristic fallback when no indicators registered', async () => {
    // No indicators set. Service skips LLM, uses heuristic. With <3
    // misconceptions and no recent activity, should be 'idle' (lastActiveAt old)
    // OR 'active'. Use a single low-score exercise.
    await repo.append({
      id: 'ex',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT_UUID,
      type: 'exercise',
      data: { step: 1, score: 50 },
      triggerEventId: 'evt-x',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await invoke();
    expect(llm.callCount).toBe(0); // no LLM
    const status = await observations.findOne({ where: { type: 'student_status' } });
    expect(status).toBeDefined();
    // single exercise, no misconceptions, recent activity → active
    expect((status!.data as Record<string, unknown>).status).toBe('active');
  });

  it('heuristic idle is reachable across repeated derivations (pass-1 MF2)', async () => {
    // Regression for pass-1 MF2: prior `computeMetrics` walked all
    // observation rows including the student_status row this service
    // itself mutates on every cascade — and `student_status.updatedAt`
    // jumped to `Date.now()` on every update. So `lastActiveAt` was
    // always ~now, `sinceLastActive` was always ~0, and `idle` was
    // unreachable.
    //
    // The fix: only count ACTIVITY_TYPES (indicator_hit/exercise/progress)
    // toward lastActiveAt, and source it from createdAt not updatedAt.
    //
    // This test seeds a stale exercise row (>3 min old), forces the
    // heuristic path, runs derivation TWICE, and asserts both runs
    // produce `idle`. Pre-fix this would have flipped to `active` on
    // the second run because the student_status row's updatedAt would
    // dominate.
    const stale = Date.now() - 5 * 60 * 1000;
    await repo.append({
      id: 'ex-stale',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT_UUID,
      type: 'exercise',
      data: { step: 1, score: 50 },
      triggerEventId: 'evt-stale',
      createdAt: stale,
      updatedAt: stale,
    });
    // No indicators registered → heuristic path (no LLM).
    await invoke();
    const first = await observations.findOne({ where: { type: 'student_status' } });
    expect((first!.data as Record<string, unknown>).status).toBe('idle');

    await invoke();
    const second = await observations.findOne({ where: { type: 'student_status' } });
    expect((second!.data as Record<string, unknown>).status).toBe('idle');
    expect(llm.callCount).toBe(0);
  });

  it('heuristic struggling when ≥3 misconception anchors', async () => {
    indicators.setIndicators(TENANT_UUID, SESSION_ID, INDICATORS);
    // 3 indicator_hits with misconception anchors
    for (let i = 0; i < 3; i++) {
      await repo.append({
        id: `h-${i}`,
        sessionId: SESSION_ID,
        entityId: 'student-1',
        solutionId: TENANT_UUID,
        type: 'indicator_hit',
        data: { anchors: [`M${i + 1}`], gist: `m${i}` },
        triggerEventId: `evt-${i}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    // Force LLM failure → falls back to heuristic
    llm.nextResult = new Error('LLM down');
    await invoke();
    const status = await observations.findOne({ where: { type: 'student_status' } });
    expect((status!.data as Record<string, unknown>).status).toBe('struggling');
    expect((status!.data as Record<string, unknown>).misconceptionCount).toBe(3);
  });

  it('computed metrics correctness', async () => {
    indicators.setIndicators(TENANT_UUID, SESSION_ID, INDICATORS);
    await repo.append({
      id: 'h1',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT_UUID,
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
      solutionId: TENANT_UUID,
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
      solutionId: TENANT_UUID,
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
      solutionId: TENANT_UUID,
      type: 'exercise',
      data: { step: 2, score: 60 },
      triggerEventId: 'e4',
      createdAt: 4000,
      updatedAt: 4000,
    });
    llm.nextResult = JSON.stringify({ status: 'active', summary: 's', alertMessage: null });
    await invoke();
    const status = await observations.findOne({ where: { type: 'student_status' } });
    expect(status!.data).toMatchObject({
      messageCount: 2,
      knowledgeCount: 2,
      misconceptionCount: 1,
      exerciseCorrectRate: 70, // avg(80, 60) rounded
    });
  });
});
