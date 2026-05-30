/**
 * End-to-end cascade integration test (pass-1 review MF1 + MF4
 * regression). Verifies the full M4 chain works through the engine —
 * NOT just the action handler called directly.
 *
 *   `engine.ingestEvent({type: 'chat_turn'})`
 *     → ChatTurnTrigger predicate matches
 *     → classify_chat_turn_indicators action runs
 *     → indicator_hit row appended
 *     → engine.cascadeEvent(student_observation_changed)
 *     → StatusChangeTrigger predicate matches
 *     → derive_student_status action runs
 *     → student_status row appended
 *
 * The earlier per-service spec tests bypass the engine (they invoke
 * the tool directly through ToolCallerProxy). Pass-1 caught that the
 * cascade was broken in production — `ManifestAccessorService.publish`
 * only fans to subscribers, not to the engine — so this test exists
 * to make sure the cascade actually fires.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { ChatTurnService } from './chat-turn/chat-turn.service';
import { StatusChangeService } from './status-change/status-change.service';
import { LLM_GATEWAY, type LlmGateway } from '../llm/llm-gateway';
import {
  IndicatorRegistryService,
  type IndicatorDef,
} from '../llm/indicator-registry.service';
import { ManifestAccessorService } from '../../ontology/manifest-accessor.service';
import {
  ONTOLOGY_REGISTRY,
  OntologyRegistryProvider,
} from '../../ontology/ontology-registry.provider';
import { LessonSessionManifest } from '../../ontology/live-lesson/lesson-session.manifest';
import { SolutionsService } from '../../solutions/solutions.service';
import { SolutionToolkitRegistry } from '../../tool-caller/solution-toolkit-registry';
import { ToolCallerProxyService } from '../../tool-caller/tool-caller-proxy.service';
import { ObservationRecord, ObserverEventRecord } from '../entities';
import { ObservationRepository } from '../persistence/observation-repository';
import { WorkflowEngineService } from '../workflow-engine.service';
import { WorkflowMetricsService } from '../workflow-metrics.service';
import { WorkflowRegistry } from '../workflow-registry';
import { SessionMetadataService } from '../../sessions/services/session-metadata.service';
import { getTestDatabaseOptions } from '../../../test/setup/test-database';
import { OntologyRegistry } from '@kedge-agentic/ontology';

const TENANT_UUID = 'tenant-cascade-test';
const SESSION_ID = 'sess-cascade-test';

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

/**
 * Returns the next canned LLM result based on call order. The cascade
 * fires TWO LLM calls — classify (ChatTurn) + derive_status
 * (StatusChange) — and the fake needs to respond differently to each.
 */
class StagedLlmGateway implements LlmGateway {
  private results: string[] = [];
  callCount = 0;
  queue(json: string): void {
    this.results.push(json);
  }
  async chat(): Promise<string> {
    this.callCount += 1;
    return this.results.shift() ?? '{}';
  }
}

const INDICATORS: IndicatorDef[] = [
  { id: 'K1', type: 'knowledge', label: 'concept', description: 'd' },
  { id: 'M1', type: 'misconception', label: 'conf', description: 'd' },
];

async function settleQueues(): Promise<void> {
  // The engine's `enqueueDispatch` is fire-and-forget from the caller's
  // perspective (see cascadeEvent jsdoc). Drain the microtask queue
  // long enough for any queued cascades to resolve.
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}

describe('M4 cascade — chat_turn → indicator_hit → student_status (through the engine)', () => {
  let module: TestingModule;
  let engine: WorkflowEngineService;
  let observations: Repository<ObservationRecord>;
  let indicators: IndicatorRegistryService;
  let llm: StagedLlmGateway;

  beforeEach(async () => {
    llm = new StagedLlmGateway();
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
        ChatTurnService,
        StatusChangeService,
        { provide: SolutionsService, useClass: FakeSolutionsService },
        { provide: LLM_GATEWAY, useValue: llm },
      ],
    }).compile();
    const ontology = module.get<OntologyRegistry>(ONTOLOGY_REGISTRY);
    ontology.registerManifest(LessonSessionManifest);
    await module.init();
    engine = module.get(WorkflowEngineService);
    indicators = module.get(IndicatorRegistryService);
    observations = module.get<Repository<ObservationRecord>>(
      getRepositoryToken(ObservationRecord),
    );
  });

  afterEach(async () => {
    await module.close();
  });

  it('chat_turn event through the engine fires the full cascade end-to-end', async () => {
    indicators.setIndicators(TENANT_UUID, SESSION_ID, INDICATORS);
    // First LLM call: classify the chat turn.
    llm.queue(
      JSON.stringify({
        action: 'append',
        anchors: ['K1'],
        gist: 'student named the concept',
        quote: 'photosynthesis',
      }),
    );
    // Second LLM call: derive_student_status.
    llm.queue(
      JSON.stringify({
        status: 'active',
        summary: 'engaged',
        alertMessage: null,
      }),
    );

    await engine.ingestEvent({
      sessionId: SESSION_ID,
      solutionId: TENANT_UUID,
      manifestName: 'LessonSession',
      streamApiName: 'events',
      payload: {
        type: 'chat_turn',
        studentId: 'student-1',
        student: 'I think it is photosynthesis',
        ai: 'Tell me more',
      },
    });
    await settleQueues();

    // ChatTurnService wrote an indicator_hit row.
    const hits = await observations.find({ where: { type: 'indicator_hit' } });
    expect(hits).toHaveLength(1);
    expect(hits[0].data).toMatchObject({
      anchors: ['K1'],
      gist: 'student named the concept',
      action: 'append',
    });

    // The cascade then routed student_observation_changed back through
    // the engine, and StatusChangeService wrote a student_status row.
    const status = await observations.find({ where: { type: 'student_status' } });
    expect(status).toHaveLength(1);
    expect(status[0].data).toMatchObject({
      status: 'active',
      previousStatus: null,
    });

    // Both LLM calls happened.
    expect(llm.callCount).toBe(2);
  });

  it('cascade depth is tracked across the chain (pass-2 N2 regression)', async () => {
    // Regression for pass-1 MF1 + pass-2 N2: the in-process cascade
    // must propagate depth via AsyncLocalStorage so the engine's
    // ceiling guard can fire on runaway chains.
    //
    // We register an extra synthetic event-kind trigger watching the
    // `student_alerts` stream. StatusChangeService publishes to that
    // stream only via the bare `accessor.publish` (alerts have no
    // cascade-back path), so this stays a single-hop probe. But it
    // exercises the same trigger-registration + dispatch machinery
    // and gives us a place to assert `cascade.depth`.
    //
    // Easier shape: subscribe to the `events` stream a second time
    // and assert that the SECOND-hop event (student_observation_changed,
    // published by ChatTurnService through engine.cascadeEvent) carries
    // depth>=1. We capture by hijacking dispatchTrigger via a probe
    // trigger registered before bootstrap.
    indicators.setIndicators(TENANT_UUID, SESSION_ID, INDICATORS);
    const seenDepths: number[] = [];
    const registry = module.get(WorkflowRegistry);
    registry.register({
      apiName: 'probe_depth_tracker',
      manifest: 'LessonSession',
      semantic: 'test probe — capture cascade depth on each fire',
      kind: 'event',
      watch: { stream: 'events' },
      when: () => true,
      then: {
        action: 'noop',
        args: (input) => {
          seenDepths.push(input.cascade.depth);
          return {};
        },
        as: 'admin',
      },
    });
    llm.queue(
      JSON.stringify({
        action: 'append',
        anchors: ['K1'],
        gist: 'g',
        quote: null,
      }),
    );
    llm.queue(
      JSON.stringify({
        status: 'active',
        summary: '',
        alertMessage: null,
      }),
    );
    await engine.ingestEvent({
      sessionId: SESSION_ID,
      solutionId: TENANT_UUID,
      manifestName: 'LessonSession',
      streamApiName: 'events',
      payload: {
        type: 'chat_turn',
        studentId: 'student-1',
        student: 'I think it is photosynthesis',
        ai: 'Tell me more',
      },
    });
    await settleQueues();
    // The probe fires once per dispatched event on the 'events' stream:
    //   - chat_turn: depth 0 (root)
    //   - student_observation_changed: depth 1 (child cascade)
    expect(seenDepths).toContain(0);
    expect(seenDepths).toContain(1);
    // Confirms the cascade frame's depth+1 actually carries through
    // the enqueued dispatch.
  });

  it('engine ignores events whose payload.type does not match either trigger', async () => {
    indicators.setIndicators(TENANT_UUID, SESSION_ID, INDICATORS);
    await engine.ingestEvent({
      sessionId: SESSION_ID,
      solutionId: TENANT_UUID,
      manifestName: 'LessonSession',
      streamApiName: 'events',
      payload: { type: 'unrelated_event', whatever: 'data' },
    });
    await settleQueues();
    expect(await observations.find()).toHaveLength(0);
    expect(llm.callCount).toBe(0);
  });
});
