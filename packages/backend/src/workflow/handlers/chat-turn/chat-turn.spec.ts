/**
 * ChatTurnService tests — verifies the LLM-driven indicator
 * classification handler works without booting real OpenAI.
 *
 * Approach: provide a fake LlmGateway whose `chat` returns canned
 * JSON per-test. Assert handler:
 *   - skips when no indicators registered
 *   - skips when student or ai text missing
 *   - appends indicator_hit on action='append'
 *   - updates existing indicator_hit on action='update'
 *   - falls back to append when updateTarget not found
 *   - skips on LLM throw, on bad JSON, on unknown action
 *   - filters anchors to known indicator IDs (anti-hallucination)
 *   - publishes student_observation_changed cascade event after writes
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ChatTurnService } from './chat-turn.service';
import { LLM_GATEWAY, type LlmGateway } from '../../llm/llm-gateway';
import {
  IndicatorRegistryService,
  type IndicatorDef,
} from '../../llm/indicator-registry.service';
import { ManifestAccessorService } from '../../../ontology/manifest-accessor.service';
import {
  ONTOLOGY_REGISTRY,
  OntologyRegistryProvider,
} from '../../../ontology/ontology-registry.provider';
import { LessonSessionManifest } from '../../../ontology/live-lesson/lesson-session.manifest';
import { SolutionsService } from '../../../solutions/solutions.service';
import { SolutionToolkitRegistry } from '../../../tool-caller/solution-toolkit-registry';
import { ToolCallerProxyService } from '../../../tool-caller/tool-caller-proxy.service';
import { ObservationRecord, ObserverEventRecord } from '../../entities';
import { ObservationRepository } from '../../persistence/observation-repository';
import { WorkflowEngineService } from '../../workflow-engine.service';
import { WorkflowMetricsService } from '../../workflow-metrics.service';
import { WorkflowRegistry } from '../../workflow-registry';
import { SessionMetadataService } from '../../../sessions/services/session-metadata.service';
import { getTestDatabaseOptions } from '../../../../test/setup/test-database';
import { OntologyRegistry } from '@kedge-agentic/ontology';
import { NotFoundException } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

const TENANT_UUID = 'live-lesson-uuid-chat-turn-test';
const SESSION_ID = 'sess-chat-turn-test';

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
    throw new NotFoundException('no-op fake');
  }
  async put() {
    return { key: '', value: null, updatedAt: new Date().toISOString() };
  }
}

class FakeLlmGateway implements LlmGateway {
  nextResult: string | Error = '{"action":"skip","anchors":[],"gist":"","quote":null}';
  callCount = 0;
  async chat(): Promise<string> {
    this.callCount += 1;
    if (this.nextResult instanceof Error) throw this.nextResult;
    return this.nextResult;
  }
}

const INDICATORS: IndicatorDef[] = [
  { id: 'K1', type: 'knowledge', label: 'identifies key concept', description: 'student names the concept' },
  { id: 'M1', type: 'misconception', label: 'reverses cause and effect', description: 'student confuses direction' },
];

describe('ChatTurnService', () => {
  let module: TestingModule;
  let service: ChatTurnService;
  let indicators: IndicatorRegistryService;
  let llm: FakeLlmGateway;
  let observations: Repository<ObservationRecord>;
  let repo: ObservationRepository;
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
        ChatTurnService,
        { provide: SolutionsService, useClass: FakeSolutionsService },
        { provide: LLM_GATEWAY, useValue: llm },
      ],
    }).compile();

    service = module.get(ChatTurnService);
    indicators = module.get(IndicatorRegistryService);
    repo = module.get(ObservationRepository);
    observations = module.get<Repository<ObservationRecord>>(
      getRepositoryToken(ObservationRecord),
    );
    const ontology = module.get<OntologyRegistry>(ONTOLOGY_REGISTRY);
    ontology.registerManifest(LessonSessionManifest);

    // Capture cascade publishes
    const accessor = module.get(ManifestAccessorService);
    const originalPublish = accessor.publish.bind(accessor);
    accessor.publish = ((sessionId: string, streamApiName: string, payload: unknown) => {
      publishedEvents.push({ sessionId, streamApiName, payload });
      return originalPublish(sessionId, streamApiName, payload);
    }) as typeof accessor.publish;

    await module.init();
  });

  afterEach(async () => {
    await module.close();
  });

  async function invokeHandler(args: {
    student: string;
    ai: string;
    entityId?: string;
    triggerEventId?: string;
  }): Promise<unknown> {
    // Direct handler invocation via the engine's dispatch path is
    // complex; tap into the registered tool definition instead.
    const proxy = module.get(ToolCallerProxyService);
    return proxy.invoke(
      {
        tool: 'workflow-actions-chat-turn.classify_chat_turn_indicators',
        args: {
          entityId: args.entityId ?? 'student-1',
          student: args.student,
          ai: args.ai,
          triggerEventId: args.triggerEventId ?? 'evt-test',
        },
      },
      {
        sessionId: SESSION_ID,
        solutionId: TENANT_UUID,
        actingUserId: 'system',
        actingRole: 'admin',
      },
    );
  }

  it('skips when no indicators registered', async () => {
    indicators.setIndicators(SESSION_ID, []);
    await invokeHandler({ student: 'I think mitochondria...', ai: 'Yes, and...' });
    const obs = await observations.find();
    expect(obs).toHaveLength(0);
    expect(llm.callCount).toBe(0);
  });

  it('skips when student text is empty', async () => {
    indicators.setIndicators(SESSION_ID, INDICATORS);
    await invokeHandler({ student: '', ai: 'something' });
    expect(llm.callCount).toBe(0);
    expect(await observations.find()).toHaveLength(0);
  });

  it('LLM action=append writes a new indicator_hit observation + cascades', async () => {
    indicators.setIndicators(SESSION_ID, INDICATORS);
    llm.nextResult = JSON.stringify({
      action: 'append',
      anchors: ['K1'],
      gist: 'student named photosynthesis',
      quote: 'I think it is photosynthesis',
    });
    await invokeHandler({ student: 'I think it is photosynthesis', ai: 'Tell me more' });
    const obs = await observations.find();
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({
      type: 'indicator_hit',
      entityId: 'student-1',
      data: {
        anchors: ['K1'],
        gist: 'student named photosynthesis',
        quote: 'I think it is photosynthesis',
        action: 'append',
      },
    });
    // cascade
    expect(publishedEvents).toHaveLength(1);
    expect(publishedEvents[0]).toMatchObject({
      sessionId: SESSION_ID,
      streamApiName: 'events',
      payload: {
        type: 'student_observation_changed',
        studentId: 'student-1',
        trigger: 'chat_turn',
      },
    });
  });

  it('LLM action=update patches existing indicator_hit', async () => {
    indicators.setIndicators(SESSION_ID, INDICATORS);
    await repo.append({
      id: 'obs-prior',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT_UUID,
      type: 'indicator_hit',
      data: { anchors: ['K1'], gist: 'first attempt', quote: 'initial' },
      triggerEventId: 'evt-prior',
      createdAt: 1000,
      updatedAt: 1000,
    });
    llm.nextResult = JSON.stringify({
      action: 'update',
      updateTarget: 'obs-prior',
      anchors: ['K1'],
      gist: 'refined understanding',
      quote: 'more',
    });
    await invokeHandler({ student: 'Actually, mitochondria are the powerhouse', ai: 'Yes' });
    const obs = await observations.find();
    expect(obs).toHaveLength(1);
    expect(obs[0].data).toMatchObject({
      anchors: ['K1'],
      gist: 'refined understanding',
      action: 'update',
    });
  });

  it('LLM action=update with empty fields preserves prior row data (pass-2 SF2)', async () => {
    // Regression for pass-1 SF5: when the LLM returns action=update
    // with empty anchors/gist or null quote, the prior row's data
    // must be PRESERVED, not blanked. The LLM picked `update` because
    // the turn refines an existing observation, not to wipe it.
    indicators.setIndicators(SESSION_ID, INDICATORS);
    await repo.append({
      id: 'obs-prior',
      sessionId: SESSION_ID,
      entityId: 'student-1',
      solutionId: TENANT_UUID,
      type: 'indicator_hit',
      data: {
        anchors: ['K1', 'M1'],
        gist: 'prior detailed gist',
        quote: 'prior quote',
      },
      triggerEventId: 'evt-prior',
      createdAt: 1000,
      updatedAt: 1000,
    });
    // LLM returns update with all fields empty/blank.
    llm.nextResult = JSON.stringify({
      action: 'update',
      updateTarget: 'obs-prior',
      anchors: [],
      gist: '',
      quote: null,
    });
    await invokeHandler({ student: 'more thoughts', ai: 'Yes' });
    const obs = await observations.find();
    expect(obs).toHaveLength(1);
    // All prior fields preserved.
    expect(obs[0].data).toMatchObject({
      anchors: ['K1', 'M1'],
      gist: 'prior detailed gist',
      quote: 'prior quote',
      action: 'update',
    });
  });

  it('LLM action=update with unknown target falls back to append', async () => {
    indicators.setIndicators(SESSION_ID, INDICATORS);
    llm.nextResult = JSON.stringify({
      action: 'update',
      updateTarget: 'does-not-exist',
      anchors: ['K1'],
      gist: 'fallback',
      quote: null,
    });
    await invokeHandler({ student: 'hi', ai: 'hi' });
    const obs = await observations.find();
    expect(obs).toHaveLength(1);
    expect(obs[0].data).toMatchObject({ action: 'append', gist: 'fallback' });
  });

  it('filters hallucinated anchors to declared indicator IDs', async () => {
    indicators.setIndicators(SESSION_ID, INDICATORS);
    llm.nextResult = JSON.stringify({
      action: 'append',
      anchors: ['K1', 'NOT_A_REAL_ID', 'M1', 'PROMPT_INJECTED'],
      gist: 'something',
      quote: null,
    });
    await invokeHandler({ student: 'x', ai: 'y' });
    const obs = await observations.find();
    expect((obs[0].data as Record<string, unknown>).anchors).toEqual(['K1', 'M1']);
  });

  it('LLM throw → skip; no observation written; no cascade', async () => {
    indicators.setIndicators(SESSION_ID, INDICATORS);
    llm.nextResult = new Error('LLM 503');
    await invokeHandler({ student: 'x', ai: 'y' });
    expect(await observations.find()).toHaveLength(0);
    expect(publishedEvents).toHaveLength(0);
  });

  it('LLM bad JSON → skip', async () => {
    indicators.setIndicators(SESSION_ID, INDICATORS);
    llm.nextResult = 'this is not json';
    await invokeHandler({ student: 'x', ai: 'y' });
    expect(await observations.find()).toHaveLength(0);
  });

  it('LLM unknown action → skip', async () => {
    indicators.setIndicators(SESSION_ID, INDICATORS);
    llm.nextResult = JSON.stringify({ action: 'invalid_action', anchors: [], gist: '', quote: null });
    await invokeHandler({ student: 'x', ai: 'y' });
    expect(await observations.find()).toHaveLength(0);
  });

  it('LLM action=skip → no observation written; no cascade', async () => {
    indicators.setIndicators(SESSION_ID, INDICATORS);
    llm.nextResult = JSON.stringify({ action: 'skip', anchors: [], gist: '', quote: null });
    await invokeHandler({ student: 'x', ai: 'y' });
    expect(await observations.find()).toHaveLength(0);
    expect(publishedEvents).toHaveLength(0);
  });
});
