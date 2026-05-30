/**
 * EventIngestController integration tests.
 *
 * Proves the M1 success criterion: POST /workflow/sessions/:id/events
 * returns 202 + writes a row in `observer_events` + invokes the engine
 * (or, when disabled by env flag, persists without dispatching).
 *
 * Uses guard overrides to skip Auth (the auth guard is verified
 * separately by AuthModule's own spec); we want a tight focused test
 * on the endpoint's dedup + persistence + engine wiring.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { ScopesGuard } from '../../auth/guards/scopes.guard';
import { OntologyRegistry } from '@kedge-agentic/ontology';
import {
  ONTOLOGY_REGISTRY,
  OntologyRegistryProvider,
} from '../../ontology/ontology-registry.provider';
import { LessonSessionManifest } from '../../ontology/live-lesson/lesson-session.manifest';
import { ObservationRecord, ObserverEventRecord } from '../entities';
import { ObservationRepository } from '../persistence/observation-repository';
import { ObserverEventRepository } from '../persistence/observer-event-repository';
import { WorkflowEngineService } from '../workflow-engine.service';
import { WorkflowMetricsService } from '../workflow-metrics.service';
import { WorkflowRegistry } from '../workflow-registry';
import { EventIngestController } from './event-ingest.controller';
import { getTestDatabaseOptions } from '../../../test/setup/test-database';

class AllowAllGuard {
  canActivate(context: any) {
    // Stamp a fake request.solutionId so @TenantId() resolves.
    const req = context.switchToHttp().getRequest();
    req.solutionId = 'live-lesson-tenant-uuid';
    req.context = {
      solutionId: 'live-lesson-tenant-uuid',
      apiKeyId: 'fake',
      requestId: 'fake',
    };
    return true;
  }
}

class FakeWorkflowEngine {
  ingestCalls: Array<{
    sessionId: string;
    solutionId: string;
    streamApiName: string;
    payload: unknown;
  }> = [];

  async ingestEvent(input: {
    sessionId: string;
    solutionId: string;
    manifestName: string;
    streamApiName: string;
    payload: unknown;
    eventId?: string;
  }): Promise<boolean> {
    this.ingestCalls.push({
      sessionId: input.sessionId,
      solutionId: input.solutionId,
      streamApiName: input.streamApiName,
      payload: input.payload,
    });
    return true;
  }
}

describe('EventIngestController (integration)', () => {
  let app: INestApplication;
  let events: ObserverEventRepository;
  let fakeEngine: FakeWorkflowEngine;
  let module: TestingModule;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    originalEnv = process.env.WORKFLOW_INGEST;
    fakeEngine = new FakeWorkflowEngine();
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature([ObservationRecord, ObserverEventRecord]),
      ],
      controllers: [EventIngestController],
      providers: [
        OntologyRegistryProvider,
        ObservationRepository,
        ObserverEventRepository,
        WorkflowRegistry,
        WorkflowMetricsService,
        { provide: WorkflowEngineService, useValue: fakeEngine },
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
    events = module.get(ObserverEventRepository);
    // Register LessonSession so the controller's M-3 payload validation
    // gate has a manifest + stream to check against.
    const ontology = module.get<OntologyRegistry>(ONTOLOGY_REGISTRY);
    if (!ontology.getManifest('LessonSession')) {
      ontology.registerManifest(LessonSessionManifest);
    }
  });

  afterEach(async () => {
    process.env.WORKFLOW_INGEST = originalEnv;
    await app.close();
  });

  it('returns 202 + persists event row + dispatches when WORKFLOW_INGEST=enabled', async () => {
    process.env.WORKFLOW_INGEST = 'enabled';
    const res = await request(app.getHttpServer())
      .post('/api/v1/workflow/sessions/s1/events')
      .send({
        eventId: 'evt-1',
        manifestName: 'LessonSession',
        streamApiName: 'events',
        entityId: 'student-1',
        payload: { type: 'student_joined', studentId: 'student-1', classroomCode: 'HX3KM7' },
      })
      .expect(202);

    expect(res.body).toEqual({ accepted: true, eventId: 'evt-1' });
    expect(await events.hasEvent('evt-1')).toBe(true);
    // Engine dispatch is fire-and-forget — give the microtask a tick.
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    expect(fakeEngine.ingestCalls).toHaveLength(1);
    expect(fakeEngine.ingestCalls[0]).toEqual({
      sessionId: 's1',
      solutionId: 'live-lesson-tenant-uuid',
      streamApiName: 'events',
      payload: { type: 'student_joined', studentId: 'student-1', classroomCode: 'HX3KM7' },
    });
  });

  it('returns 200 with dropped:duplicate on a repeated eventId', async () => {
    process.env.WORKFLOW_INGEST = 'enabled';
    const body = {
      eventId: 'evt-dup',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: 'student-1',
      payload: { type: 'student_joined', studentId: 'student-1', classroomCode: 'HX3KM7' },
    };
    await request(app.getHttpServer())
      .post('/api/v1/workflow/sessions/s1/events')
      .send(body)
      .expect(202);
    const second = await request(app.getHttpServer())
      .post('/api/v1/workflow/sessions/s1/events')
      .send(body)
      .expect(200);
    expect(second.body).toEqual({
      accepted: false,
      dropped: 'duplicate',
      eventId: 'evt-dup',
    });
    expect(fakeEngine.ingestCalls).toHaveLength(1);
  });

  it('persists but skips dispatch when WORKFLOW_INGEST is not enabled', async () => {
    delete process.env.WORKFLOW_INGEST;
    const res = await request(app.getHttpServer())
      .post('/api/v1/workflow/sessions/s1/events')
      .send({
        eventId: 'evt-disabled',
        manifestName: 'LessonSession',
        streamApiName: 'events',
        entityId: 'student-1',
        payload: { type: 'student_joined', studentId: 'student-1', classroomCode: 'HX3KM7' },
      })
      .expect(202);
    expect(res.body).toEqual({
      accepted: false,
      dropped: 'disabled',
      eventId: 'evt-disabled',
    });
    // Still persisted so the outbox-side can mark its row delivered.
    expect(await events.hasEvent('evt-disabled')).toBe(true);
    // Dispatch did NOT happen.
    expect(fakeEngine.ingestCalls).toHaveLength(0);
  });

  it('M-3 schema validation: returns 400 when payload does not match StreamDef.payloadSchema', async () => {
    process.env.WORKFLOW_INGEST = 'enabled';
    const res = await request(app.getHttpServer())
      .post('/api/v1/workflow/sessions/s1/events')
      .send({
        eventId: 'evt-bad-payload',
        manifestName: 'LessonSession',
        streamApiName: 'events',
        entityId: 'student-1',
        payload: { type: 'student_joined' /* missing studentId + classroomCode */ },
      })
      .expect(400);
    expect(res.body.message).toMatch(/payload does not match.+payloadSchema/);
    // Critically: row was NOT persisted (avoids observer_events bloat).
    expect(await events.hasEvent('evt-bad-payload')).toBe(false);
    // Engine NOT called.
    expect(fakeEngine.ingestCalls).toHaveLength(0);
  });

  it('M-3 manifest/stream check: returns 400 on unknown manifestName', async () => {
    process.env.WORKFLOW_INGEST = 'enabled';
    await request(app.getHttpServer())
      .post('/api/v1/workflow/sessions/s1/events')
      .send({
        eventId: 'evt-bad-mf',
        manifestName: 'DoesNotExist',
        streamApiName: 'events',
        entityId: 'e',
        payload: { type: 'student_joined', studentId: 's', classroomCode: 'c' },
      })
      .expect(400);
  });

  it('M-3 manifest/stream check: returns 400 on unknown streamApiName', async () => {
    process.env.WORKFLOW_INGEST = 'enabled';
    await request(app.getHttpServer())
      .post('/api/v1/workflow/sessions/s1/events')
      .send({
        eventId: 'evt-bad-stream',
        manifestName: 'LessonSession',
        streamApiName: 'bogus_stream',
        entityId: 'e',
        payload: { type: 'student_joined', studentId: 's', classroomCode: 'c' },
      })
      .expect(400);
  });

  it('returns 400 on missing required fields (class-validator)', async () => {
    process.env.WORKFLOW_INGEST = 'enabled';
    await request(app.getHttpServer())
      .post('/api/v1/workflow/sessions/s1/events')
      .send({
        eventId: 'evt-x',
        // missing manifestName, streamApiName, entityId, payload
      })
      .expect(400);
  });

  it('M-1 race: concurrent POSTs with same eventId → exactly one persisted + one duplicate', async () => {
    process.env.WORKFLOW_INGEST = 'enabled';
    const body = {
      eventId: 'evt-concurrent',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: 'student-1',
      payload: { type: 'student_joined', studentId: 'student-1', classroomCode: 'HX3KM7' },
    };
    const [r1, r2] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/workflow/sessions/s1/events')
        .send(body),
      request(app.getHttpServer())
        .post('/api/v1/workflow/sessions/s1/events')
        .send(body),
    ]);
    // One returns 202 accepted, the other returns 200 duplicate.
    // Both are non-5xx so the outbox client sees a stable outcome.
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 202]);
    const accepted = (r1.status === 202 ? r1 : r2).body;
    const dup = (r1.status === 200 ? r1 : r2).body;
    expect(accepted.accepted).toBe(true);
    expect(dup.dropped).toBe('duplicate');
    expect(await events.hasEvent('evt-concurrent')).toBe(true);
    // Wait long enough for any fire-and-forget dispatch to settle.
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    // Engine dispatched at most ONCE (the accepted call's fire-and-forget).
    expect(fakeEngine.ingestCalls.length).toBeLessThanOrEqual(1);
  });
});
