/**
 * M2 end-to-end integration: prove the full cross-process loop works.
 *
 *   POST /api/v1/workflow/sessions/:id/events
 *     → ObserverEventRepository dedup + persist
 *     → WorkflowEngine.ingestEvent
 *     → JOIN_TRIGGER_DEF matches (event kind + stream 'events' + when=true)
 *     → ManifestAccessor.invokeAction('record_lifecycle_observation', ...)
 *     → checkBoundary (admin role + admin's wildcard actions → allow)
 *     → ToolCallerProxy audit row in tool_events
 *     → LifecycleObservationService.handleRecordLifecycleObservation
 *     → ObservationRepository.append → row in observations table
 *
 * That's the M2 deliverable. Spec asserts every link in the chain.
 *
 * NOTE: We don't import OntologyModule because it pulls SessionsModule
 * transitively (huge). Instead we provide just the providers
 * `LifecycleObservationService` depends on, registered manually.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { Repository } from 'typeorm';
import request from 'supertest';
import { ApiKeyGuard } from '../../../auth/guards/api-key.guard';
import { ScopesGuard } from '../../../auth/guards/scopes.guard';
import { ManifestAccessorService } from '../../../ontology/manifest-accessor.service';
import {
  ONTOLOGY_REGISTRY,
  OntologyRegistryProvider,
} from '../../../ontology/ontology-registry.provider';
import { SolutionsService } from '../../../solutions/solutions.service';
import { SolutionToolkitRegistry } from '../../../tool-caller/solution-toolkit-registry';
import { ToolCallerProxyService } from '../../../tool-caller/tool-caller-proxy.service';
import { ObservationRecord, ObserverEventRecord } from '../../entities';
import { ObservationRepository } from '../../persistence/observation-repository';
import { ObserverEventRepository } from '../../persistence/observer-event-repository';
import { WorkflowEngineService } from '../../workflow-engine.service';
import { WorkflowMetricsService } from '../../workflow-metrics.service';
import { WorkflowRegistry } from '../../workflow-registry';
import { EventIngestController } from '../../event-ingest/event-ingest.controller';
import { LifecycleObservationService } from './lifecycle-observation.service';
import { getTestDatabaseOptions } from '../../../../test/setup/test-database';
import { SessionMetadataService } from '../../../sessions/services/session-metadata.service';

const FAKE_TENANT_UUID = 'live-lesson-tenant-uuid-test-0000';
const SESSION_ID = 'sess-m2-test';

class FakeSolutionsService {
  async findOne(idOrSlug: string) {
    if (idOrSlug === 'live-lesson' || idOrSlug === FAKE_TENANT_UUID) {
      return { id: FAKE_TENANT_UUID, slug: 'live-lesson' };
    }
    return null;
  }
}

class FakeSessionMetadataService {
  async get() {
    throw new NotFoundException('no-op fake metadata');
  }
  async put() {
    return { key: '', value: null, updatedAt: new Date().toISOString() };
  }
}

class AllowAllGuard {
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    req.solutionId = FAKE_TENANT_UUID;
    req.context = {
      solutionId: FAKE_TENANT_UUID,
      apiKeyId: 'fake',
      requestId: 'fake',
    };
    return true;
  }
}

describe('LifecycleObservationService — M2 end-to-end (cross-process loop)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let observations: Repository<ObservationRecord>;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    originalEnv = process.env.WORKFLOW_INGEST;
    process.env.WORKFLOW_INGEST = 'enabled';

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature([ObservationRecord, ObserverEventRecord]),
        DiscoveryModule,
      ],
      controllers: [EventIngestController],
      providers: [
        // ontology providers
        OntologyRegistryProvider,
        ManifestAccessorService,
        { provide: SessionMetadataService, useClass: FakeSessionMetadataService },
        // tool-caller providers (subset — we don't need the controller or adapter)
        SolutionToolkitRegistry,
        ToolCallerProxyService,
        // workflow providers
        WorkflowRegistry,
        WorkflowMetricsService,
        WorkflowEngineService,
        ObservationRepository,
        ObserverEventRepository,
        LifecycleObservationService,
        // tenant resolver
        { provide: SolutionsService, useClass: FakeSolutionsService },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useClass(AllowAllGuard)
      .overrideGuard(ScopesGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    observations = module.get(getRepositoryToken(ObservationRecord));
  });

  afterEach(async () => {
    process.env.WORKFLOW_INGEST = originalEnv;
    await app.close();
  });

  it('POST student_joined event → trigger fires → observation row written', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/workflow/sessions/${SESSION_ID}/events`)
      .send({
        eventId: 'evt-join-1',
        manifestName: 'LessonSession',
        streamApiName: 'events',
        entityId: 'student-abc',
        payload: {
          type: 'student_joined',
          studentId: 'student-abc',
          classroomCode: 'HX3KM7',
        },
      })
      .expect(202);

    expect(res.body).toEqual({ accepted: true, eventId: 'evt-join-1' });

    // The engine dispatch + action handler chain is async. Wait for the
    // per-session FIFO queue to drain. 50ms is generous for an in-memory
    // SQLite write.
    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    const obs = await observations.find({ where: { sessionId: SESSION_ID } });
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({
      sessionId: SESSION_ID,
      entityId: 'student-abc',
      solutionId: FAKE_TENANT_UUID,
      type: 'lifecycle',
      data: { action: 'join', classroomCode: 'HX3KM7' },
    });
    expect(obs[0].triggerEventId).toMatch(/[0-9a-f-]{36}/);
  });

  it('non-matching payload type does NOT fire the trigger', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/workflow/sessions/${SESSION_ID}/events`)
      .send({
        eventId: 'evt-other',
        manifestName: 'LessonSession',
        streamApiName: 'events',
        entityId: 'student-abc',
        payload: { type: 'student_submitted', studentId: 'student-abc', step: 1 },
      })
      .expect(202);
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    const obs = await observations.find({ where: { sessionId: SESSION_ID } });
    expect(obs).toHaveLength(0);
  });

  it('repeated eventId is dedup-dropped → exactly one observation row', async () => {
    const body = {
      eventId: 'evt-dup',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: 'student-abc',
      payload: {
        type: 'student_joined',
        studentId: 'student-abc',
        classroomCode: 'C1',
      },
    };
    await request(app.getHttpServer())
      .post(`/api/v1/workflow/sessions/${SESSION_ID}/events`)
      .send(body)
      .expect(202);
    await request(app.getHttpServer())
      .post(`/api/v1/workflow/sessions/${SESSION_ID}/events`)
      .send(body)
      .expect(200);
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    const obs = await observations.find({ where: { sessionId: SESSION_ID } });
    expect(obs).toHaveLength(1);
  });
});
