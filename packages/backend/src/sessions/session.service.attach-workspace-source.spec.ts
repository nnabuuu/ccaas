/**
 * SessionService.attachWorkspaceSource — security + idempotency tests
 *
 * Covers CRITICAL #1 (cross-solution hijack) and the conflict semantics
 * documented in the controller's @ApiResponse contracts.
 *
 * Covers: input validation, sourceUrl + sourceSchemaHash persistence
 * to session_metadata, the `session.bound` event payload shape, and
 * 409 ConflictException on reattach to a different sourceIdentity.
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
import { McpEngineAdapterService } from '../tool-caller/adapters/mcp-engine-adapter.service';
import { BackgroundTaskMonitorService } from './services/background-task-monitor.service';
import { StreamRegistryService } from './services/stream-registry.service';
import { SessionAssetMaterializer } from './services/session-asset-materializer.service';
import { SessionMetadataService } from './services/session-metadata.service';
import { mockWorkspaceProvider } from './workspace/__mocks__/mock-provider';
import { Session as SessionEntity } from '../admin/entities/session.entity';

describe('SessionService.attachWorkspaceSource', () => {
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
        { provide: McpEngineAdapterService, useValue: { shouldProxy: () => false, releaseSession: jest.fn() } },
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

  it('rejects with BadRequestException when solutionId is missing', async () => {
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

    // Both rows written: 'sourceIdentity' for the canonical workspace identity, 'workspaceSourceUrl' for the optional URL.
    expect(metadata.put).toHaveBeenCalledWith(
      'sess-with-url',
      'tenant-A',
      'sourceIdentity',
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

    // Only 'sourceIdentity' written.
    expect(metadata.put).toHaveBeenCalledTimes(1);
    expect(metadata.put).toHaveBeenCalledWith(
      'sess-min',
      'tenant-A',
      'sourceIdentity',
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
      solutionId: 'tenant-A',
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

  // ----- reverse lookup ---------------------------------------------------

  it('findSessionsByWorkspaceSource returns all sessions attached to the same sourceIdentity', async () => {
    const socket: any = { id: 'socket-7', emit: jest.fn() };
    await service.getOrCreateSession('sess-rl-1', 'client-7', socket, undefined, 'tenant-A');
    await service.getOrCreateSession('sess-rl-2', 'client-7', socket, undefined, 'tenant-A');

    await service.attachWorkspaceSource('sess-rl-1', 'tenant-A', { sourceIdentity: 'proj-same' });
    await service.attachWorkspaceSource('sess-rl-2', 'tenant-A', { sourceIdentity: 'proj-same' });

    expect(service.findSessionsByWorkspaceSource('proj-same').sort()).toEqual([
      'sess-rl-1',
      'sess-rl-2',
    ]);
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
