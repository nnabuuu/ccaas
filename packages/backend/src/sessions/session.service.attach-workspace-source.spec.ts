/**
 * SessionService.attachWorkspaceSource (and its legacy alias
 * `bindToProject`) — security + idempotency tests
 *
 * Covers CRITICAL #1 (cross-tenant hijack) and the conflict semantics
 * documented in the controller's @ApiResponse contracts.
 *
 * File renamed from `session.service.bind-project.spec.ts` in β-2
 * (2026-05-26). Both code paths are exercised here:
 *
 *   1. The legacy `bindToProject(sessionId, tenantId, projectId)`
 *      alias is tested in the first describe block. Now a deprecated
 *      delegating alias that calls attachWorkspaceSource internally
 *      with `{sourceIdentity: projectId}`. These tests stayed verbatim
 *      from the pre-β-2 spec — they're the real proof that the alias
 *      path still works for legacy callers (the `bind-project` HTTP
 *      route + e2e helper).
 *
 *   2. The canonical `attachWorkspaceSource(sessionId, tenantId,
 *      WorkspaceSource)` method is tested in the second describe
 *      block. Covers the new behavior: `sourceUrl` + `sourceSchemaHash`
 *      persistence to session_metadata, the extended `session.bound`
 *      event payload, and the parity between alias + canonical paths.
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

describe('SessionService.bindToProject — legacy alias path (CRITICAL #1)', () => {
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

    // β-2: event payload carries both shapes for the compat window.
    // Legacy listeners read `projectId`; β-3 listeners read
    // `workspaceSource`. Both fields hold the same identity.
    expect(eventEmitter.emit).toHaveBeenCalledWith('session.bound', {
      sessionId: 'sess-happy',
      tenantId: 'tenant-A',
      projectId: 'proj-happy',
      workspaceSource: { sourceIdentity: 'proj-happy' },
    });
    // session_metadata still keyed by 'projectId' for compat — β-3's
    // SessionMetadataProjectTenantResolver reads this exact row.
    expect(metadata.put).toHaveBeenCalledWith(
      'sess-happy',
      'tenant-A',
      'projectId',
      'proj-happy',
    );
    // Alias path does NOT write the new `workspaceSourceUrl` row
    // because `bindToProject` only knows about sourceIdentity.
    expect(metadata.put).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'workspaceSourceUrl',
      expect.anything(),
    );
  });
});

// ── canonical attachWorkspaceSource — β-2 ─────────────────────────────────
//
// The new method takes a WorkspaceSource descriptor instead of a flat
// projectId. Covers: sourceUrl + sourceSchemaHash persistence,
// extended event payload, and the canonical/alias parity (a
// `bindToProject` call must land in the same in-memory + metadata
// state as the equivalent `attachWorkspaceSource({sourceIdentity})`
// call). Validation + cross-tenant + 409-rebind paths are the same as
// the alias above, just tested through the canonical name to make
// sure the new entry point doesn't accidentally weaken any guard.

describe('SessionService.attachWorkspaceSource (canonical, β-2)', () => {
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

  it('rejects with BadRequestException when sourceIdentity is missing', async () => {
    await expect(
      service.attachWorkspaceSource('any-session', 'tenant-a', { sourceIdentity: '' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects with BadRequestException when tenantId is missing', async () => {
    const socket: any = { id: 'socket-1', emit: jest.fn() };
    await service.getOrCreateSession('sess-canon-1', 'client-1', socket);

    await expect(
      service.attachWorkspaceSource('sess-canon-1', '', { sourceIdentity: 'p' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects with NotFoundException for unknown session', async () => {
    await expect(
      service.attachWorkspaceSource('ghost-session', 'tenant-a', { sourceIdentity: 'p' }),
    ).rejects.toThrow(NotFoundException);
  });

  // ----- new persistence behavior (sourceUrl + sourceSchemaHash) ----------

  it('persists sourceUrl to session_metadata when provided', async () => {
    const socket: any = { id: 'socket-2', emit: jest.fn() };
    await service.getOrCreateSession('sess-with-url', 'client-2', socket, undefined, 'tenant-A');

    await service.attachWorkspaceSource('sess-with-url', 'tenant-A', {
      sourceIdentity: 'proj-1',
      sourceUrl: 'http://live-lesson.local/api/projects',
    });

    // Both rows written: 'projectId' for compat, 'workspaceSourceUrl' for β-3.
    expect(metadata.put).toHaveBeenCalledWith(
      'sess-with-url',
      'tenant-A',
      'projectId',
      'proj-1',
    );
    expect(metadata.put).toHaveBeenCalledWith(
      'sess-with-url',
      'tenant-A',
      'workspaceSourceUrl',
      'http://live-lesson.local/api/projects',
    );
  });

  it('persists sourceSchemaHash to session_metadata when provided', async () => {
    const socket: any = { id: 'socket-3', emit: jest.fn() };
    await service.getOrCreateSession('sess-with-hash', 'client-3', socket, undefined, 'tenant-A');

    await service.attachWorkspaceSource('sess-with-hash', 'tenant-A', {
      sourceIdentity: 'proj-1',
      sourceSchemaHash: 'sha256:abcd1234',
    });

    expect(metadata.put).toHaveBeenCalledWith(
      'sess-with-hash',
      'tenant-A',
      'workspaceSourceSchemaHash',
      'sha256:abcd1234',
    );
  });

  it('skips workspaceSourceUrl / workspaceSourceSchemaHash rows when those fields are absent', async () => {
    const socket: any = { id: 'socket-4', emit: jest.fn() };
    await service.getOrCreateSession('sess-min', 'client-4', socket, undefined, 'tenant-A');

    await service.attachWorkspaceSource('sess-min', 'tenant-A', { sourceIdentity: 'proj-1' });

    // Only 'projectId' written.
    expect(metadata.put).toHaveBeenCalledTimes(1);
    expect(metadata.put).toHaveBeenCalledWith(
      'sess-min',
      'tenant-A',
      'projectId',
      'proj-1',
    );
  });

  // ----- event payload ----------------------------------------------------

  it('emits session.bound with workspaceSource carrying the full descriptor', async () => {
    const socket: any = { id: 'socket-5', emit: jest.fn() };
    await service.getOrCreateSession('sess-event', 'client-5', socket, undefined, 'tenant-A');

    await service.attachWorkspaceSource('sess-event', 'tenant-A', {
      sourceIdentity: 'proj-event',
      sourceUrl: 'http://x',
      sourceSchemaHash: 'sha256:f00',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith('session.bound', {
      sessionId: 'sess-event',
      tenantId: 'tenant-A',
      // Compat field carries the same value as workspaceSource.sourceIdentity.
      projectId: 'proj-event',
      workspaceSource: {
        sourceIdentity: 'proj-event',
        sourceUrl: 'http://x',
        sourceSchemaHash: 'sha256:f00',
      },
    });
  });

  // ----- 409 conflict semantics on canonical method -----------------------

  it('throws ConflictException when reattaching to a DIFFERENT sourceIdentity', async () => {
    const socket: any = { id: 'socket-6', emit: jest.fn() };
    await service.getOrCreateSession('sess-conflict-canon', 'client-6', socket, undefined, 'tenant-A');

    await service.attachWorkspaceSource('sess-conflict-canon', 'tenant-A', { sourceIdentity: 'p1' });

    await expect(
      service.attachWorkspaceSource('sess-conflict-canon', 'tenant-A', { sourceIdentity: 'p2' }),
    ).rejects.toThrow(ConflictException);
  });

  // ----- alias/canonical parity ------------------------------------------

  it('bindToProject(sid, t, pid) lands the same in-memory + metadata state as attachWorkspaceSource(sid, t, {sourceIdentity: pid})', async () => {
    const socket: any = { id: 'socket-7', emit: jest.fn() };
    await service.getOrCreateSession('sess-parity-1', 'client-7', socket, undefined, 'tenant-A');
    await service.getOrCreateSession('sess-parity-2', 'client-7', socket, undefined, 'tenant-A');

    // Capture metadata writes from each path separately. Both paths
    // are expected to land EXACTLY the same `metadata.put` calls
    // modulo the sessionId (different per session). This is what
    // makes the alias safe: any future "helpful" default added to
    // bindToProject (e.g. populating sourceUrl from somewhere) would
    // break this assertion immediately.
    metadata.put.mockClear();
    await service.bindToProject('sess-parity-1', 'tenant-A', 'proj-same');
    const aliasMetadataCalls = metadata.put.mock.calls.map((args: unknown[]) =>
      [args[0], args[1], args[2], args[3]],
    );

    metadata.put.mockClear();
    await service.attachWorkspaceSource('sess-parity-2', 'tenant-A', { sourceIdentity: 'proj-same' });
    const canonicalMetadataCalls = metadata.put.mock.calls.map((args: unknown[]) =>
      [args[0], args[1], args[2], args[3]],
    );

    // Normalize sessionId out of position 0 so the deep equal can
    // compare just the metadata write SHAPES.
    const normalize = (calls: unknown[][]) => calls.map(([, ...rest]) => rest);
    expect(normalize(aliasMetadataCalls)).toEqual(normalize(canonicalMetadataCalls));

    const fromAlias = service.getAttachedWorkspaceSource('sess-parity-1');
    const fromCanonical = service.getAttachedWorkspaceSource('sess-parity-2');

    // Identical Map values — alias delegation is transparent.
    expect(fromAlias).toEqual(fromCanonical);
    expect(fromAlias).toEqual({ sourceIdentity: 'proj-same' });

    // Both also reverse-lookup correctly via either method name.
    expect(service.findSessionsByWorkspaceSource('proj-same').sort()).toEqual([
      'sess-parity-1',
      'sess-parity-2',
    ]);
    expect(service.findSessionsByProjectId('proj-same').sort()).toEqual([
      'sess-parity-1',
      'sess-parity-2',
    ]);

    // Legacy accessor returns just the identity (drops the rest of
    // the descriptor); canonical accessor returns the full object.
    expect(service.getBoundProjectId('sess-parity-1')).toBe('proj-same');
  });

  it('getAttachedWorkspaceSource preserves sourceUrl + sourceSchemaHash for canonical writers', async () => {
    const socket: any = { id: 'socket-8', emit: jest.fn() };
    await service.getOrCreateSession('sess-get', 'client-8', socket, undefined, 'tenant-A');

    await service.attachWorkspaceSource('sess-get', 'tenant-A', {
      sourceIdentity: 'proj-x',
      sourceUrl: 'http://x',
      sourceSchemaHash: 'sha256:y',
    });

    expect(service.getAttachedWorkspaceSource('sess-get')).toEqual({
      sourceIdentity: 'proj-x',
      sourceUrl: 'http://x',
      sourceSchemaHash: 'sha256:y',
    });
  });
});
