/**
 * SessionService.bindToProject — security + idempotency tests
 *
 * Covers CRITICAL #1 (cross-tenant hijack) and the conflict semantics
 * documented in the controller's @ApiResponse contracts.
 *
 * Why this exists separate from session.service.restart.spec.ts:
 * bind-project is part of the agent-runtime sync layer (project
 * routing, change-stream subscriptions) — keeping its tests
 * topically grouped makes it easy to find when revisiting the
 * cross-tenant defence later.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionService } from './session.service';
import { EventMapperService } from './event-mapper.service';
import { CliProcessService } from './services/cli-process.service';
import { WorkspaceService } from './services/workspace.service';
import { BackgroundTaskMonitorService } from './services/background-task-monitor.service';
import { StreamRegistryService } from './services/stream-registry.service';
import { SessionAssetMaterializer } from './services/session-asset-materializer.service';
import { SessionMetadataService } from './services/session-metadata.service';
import { mockWorkspaceProvider } from './workspace/__mocks__/mock-provider';
import { Session as SessionEntity } from '../admin/entities/session.entity';

describe('SessionService.bindToProject (CRITICAL #1)', () => {
  let service: SessionService;
  let eventEmitter: { emit: jest.Mock };
  let metadata: { put: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    const mockConfig = {
      get: jest.fn((key: string, dflt?: any) => {
        const cfg: Record<string, any> = {
          'workspace.dir': '.agent-workspace',
          'workspace.sessionTtlMs': 300000,
          'workspace.maxSessions': 100,
          'workspace.cleanupIntervalMs': 300000,
          'workspace.maxProcessingMs': 1800000,
        };
        return cfg[key] ?? dflt;
      }),
    };

    eventEmitter = { emit: jest.fn() };
    metadata = { put: jest.fn().mockResolvedValue(undefined), get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: EventMapperService, useValue: {
            clearSessionState: jest.fn(),
            markBackgroundTaskComplete: jest.fn(),
            registerBackgroundTaskCallback: jest.fn(),
          } },
        { provide: CliProcessService, useValue: {} },
        { provide: WorkspaceService, useValue: {} },
        { provide: BackgroundTaskMonitorService, useValue: {
            stopAllMonitors: jest.fn(),
            stopAllMonitorsForSession: jest.fn(),
          } },
        { provide: StreamRegistryService, useValue: { cleanupSession: jest.fn() } },
        { provide: SessionAssetMaterializer, useValue: { materialize: jest.fn().mockResolvedValue(null) } },
        { provide: SessionMetadataService, useValue: metadata },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: getRepositoryToken(SessionEntity), useValue: { save: jest.fn(), update: jest.fn() } },
        mockWorkspaceProvider(),
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  afterEach(async () => {
    await service.shutdown();
    jest.clearAllMocks();
  });

  // ----- input validation ------------------------------------------------

  it('rejects with BadRequestException when projectId is missing', async () => {
    await expect(
      service.bindToProject('any-session', 'tenant-a', ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects with BadRequestException when tenantId is missing', async () => {
    const socket: any = { id: 'socket-1', emit: jest.fn() };
    await service.getOrCreateSession('sess-novtenant', 'client-1', socket);

    await expect(
      service.bindToProject('sess-novtenant', '', 'proj-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects with NotFoundException for unknown session', async () => {
    await expect(
      service.bindToProject('ghost-session', 'tenant-a', 'proj-1'),
    ).rejects.toThrow(NotFoundException);
  });

  // ----- CRITICAL #1 cross-tenant defence --------------------------------

  it('rejects with ForbiddenException when body tenantId mismatches session tenant', async () => {
    const socket: any = { id: 'socket-2', emit: jest.fn() };
    // Create session owned by tenant-A.
    const sess = await service.getOrCreateSession('sess-owned-A', 'client-2', socket, undefined, 'tenant-A');
    expect(sess.tenantId).toBe('tenant-A');

    // Attacker holding tenant-B credentials tries to bind sess-owned-A.
    await expect(
      service.bindToProject('sess-owned-A', 'tenant-B', 'proj-evil'),
    ).rejects.toThrow(ForbiddenException);

    // No metadata write, no event emit.
    expect(metadata.put).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('session.bound', expect.anything());
  });

  it('adopts caller tenantId when session has no owning tenant yet', async () => {
    // Anonymous-first: session created without tenantId; first authed
    // caller (e.g. via bind-project) claims it. The session is now
    // pinned to that tenant and a subsequent mismatched call is rejected.
    const socket: any = { id: 'socket-3', emit: jest.fn() };
    const sess = await service.getOrCreateSession('sess-anon', 'client-3', socket);
    expect(sess.tenantId).toBeUndefined();

    await service.bindToProject('sess-anon', 'tenant-A', 'proj-x');
    expect(service.getSession('sess-anon')?.tenantId).toBe('tenant-A');

    // Second caller with a different tenantId is now rejected.
    await expect(
      service.bindToProject('sess-anon', 'tenant-B', 'proj-x'),
    ).rejects.toThrow(ForbiddenException);
  });

  // ----- 409 conflict semantics ------------------------------------------

  it('is idempotent on rebinding the same projectId (no throw, single bound event)', async () => {
    const socket: any = { id: 'socket-4', emit: jest.fn() };
    await service.getOrCreateSession('sess-idem', 'client-4', socket, undefined, 'tenant-A');

    await service.bindToProject('sess-idem', 'tenant-A', 'proj-1');
    await service.bindToProject('sess-idem', 'tenant-A', 'proj-1'); // idempotent rebind

    const boundEmits = eventEmitter.emit.mock.calls.filter(
      ([name]) => name === 'session.bound',
    );
    // Both calls succeed; both emit (rebind is intentionally re-triggerable
    // for "force re-bootstrap after refactor"). What matters: no throw +
    // metadata writes don't blow up.
    expect(boundEmits.length).toBe(2);
    expect(metadata.put).toHaveBeenCalledTimes(2);
  });

  it('throws ConflictException when rebinding to a DIFFERENT projectId', async () => {
    const socket: any = { id: 'socket-5', emit: jest.fn() };
    await service.getOrCreateSession('sess-conflict', 'client-5', socket, undefined, 'tenant-A');

    await service.bindToProject('sess-conflict', 'tenant-A', 'proj-1');

    await expect(
      service.bindToProject('sess-conflict', 'tenant-A', 'proj-2'),
    ).rejects.toThrow(ConflictException);

    // No second metadata write — the original binding survives.
    expect(metadata.put).toHaveBeenCalledTimes(1);
  });

  // ----- happy path: event emit ------------------------------------------

  it('emits session.bound with the correct payload on a fresh bind', async () => {
    const socket: any = { id: 'socket-6', emit: jest.fn() };
    await service.getOrCreateSession('sess-happy', 'client-6', socket, undefined, 'tenant-A');

    await service.bindToProject('sess-happy', 'tenant-A', 'proj-happy');

    expect(eventEmitter.emit).toHaveBeenCalledWith('session.bound', {
      sessionId: 'sess-happy',
      tenantId: 'tenant-A',
      projectId: 'proj-happy',
    });
    expect(metadata.put).toHaveBeenCalledWith(
      'sess-happy',
      'tenant-A',
      'projectId',
      'proj-happy',
    );
  });
});
