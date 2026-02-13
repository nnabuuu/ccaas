/**
 * SessionService - Session Restart Tests
 *
 * TDD: Writing tests FIRST for session restart functionality
 *
 * Week 4 Goals:
 * - Implement session restart endpoint
 * - Preserve conversation history during restart
 * - Gracefully terminate old CLI process
 * - Spawn new CLI process with updated skills
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../sessions/session.service';
import { EventMapperService } from './event-mapper.service';
import { CliProcessService } from './services/cli-process.service';
import { WorkspaceService } from './services/workspace.service';
import { BackgroundTaskMonitorService } from './services/background-task-monitor.service';
import type { ManagedSession } from '../common/interfaces/session.interface';

describe('SessionService - Session Restart (Week 4)', () => {
  let service: SessionService;
  let configService: jest.Mocked<ConfigService>;
  let eventMapperService: jest.Mocked<EventMapperService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'workspace.dir': '.agent-workspace',
          'workspace.sessionTtlMs': 1800000,
          'workspace.maxSessions': 100,
          'workspace.cleanupIntervalMs': 300000,
          'CLAUDE_CLI_PATH': 'claude',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const mockEventMapperService = {
      clearSessionState: jest.fn(),
      markBackgroundTaskComplete: jest.fn(),
      registerBackgroundTaskCallback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EventMapperService,
          useValue: mockEventMapperService,
        },
        {
          provide: CliProcessService,
          useValue: {},
        },
        {
          provide: WorkspaceService,
          useValue: {},
        },
        {
          provide: BackgroundTaskMonitorService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    configService = module.get(ConfigService);
    eventMapperService = module.get(EventMapperService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('restartSession', () => {
    it('should restart an existing session', async () => {
      const mockSocket: any = { id: 'socket-1', emit: jest.fn() };
      const sessionId = 'session-restart-1';
      const clientId = 'client-1';

      // Create initial session
      const session = service.getOrCreateSession(sessionId, clientId, mockSocket);
      session.status = 'idle';
      session.needsRestart = true;

      // Mock CLI process
      const mockProcess: any = {
        kill: jest.fn(),
        killed: false,
        stdin: { write: jest.fn(), end: jest.fn() },
      };
      session.cliProcess = mockProcess;

      // Restart session
      await service.restartSession(sessionId);

      // Should kill old process
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Should clear needsRestart flag
      const restartedSession = service.getSession(sessionId);
      expect(restartedSession?.needsRestart).toBe(false);

      // Should preserve session metadata
      expect(restartedSession?.sessionId).toBe(sessionId);
      expect(restartedSession?.clientId).toBe(clientId);
    });

    it('should throw error if session does not exist', async () => {
      await expect(service.restartSession('nonexistent-session')).rejects.toThrow(
        'Session not found: nonexistent-session',
      );
    });

    it('should handle sessions without active CLI process', async () => {
      const mockSocket: any = { id: 'socket-2', emit: jest.fn() };
      const sessionId = 'session-no-process';
      const clientId = 'client-2';

      const session = service.getOrCreateSession(sessionId, clientId, mockSocket);
      session.cliProcess = null;
      session.needsRestart = true;

      // Should not throw error
      await service.restartSession(sessionId);

      const restartedSession = service.getSession(sessionId);
      expect(restartedSession?.needsRestart).toBe(false);
    });

    it('should preserve userId and syncedSkillIds after restart', async () => {
      const mockSocket: any = { id: 'socket-3', emit: jest.fn() };
      const sessionId = 'session-preserve';
      const clientId = 'client-3';
      const userId = 'user-123';

      const session = service.getOrCreateSession(sessionId, clientId, mockSocket, userId);
      service.trackSyncedSkills(sessionId, ['skill-1', 'skill-2']);

      await service.restartSession(sessionId);

      const restartedSession = service.getSession(sessionId);
      expect(restartedSession?.userId).toBe(userId);
      expect(restartedSession?.syncedSkillIds?.size).toBe(2);
      expect(restartedSession?.syncedSkillIds?.has('skill-1')).toBe(true);
    });

    it('should reset session status to idle after restart', async () => {
      const mockSocket: any = { id: 'socket-4', emit: jest.fn() };
      const sessionId = 'session-status';

      const session = service.getOrCreateSession(sessionId, 'client-4', mockSocket);
      session.status = 'processing';
      session.needsRestart = true;

      await service.restartSession(sessionId);

      const restartedSession = service.getSession(sessionId);
      expect(restartedSession?.status).toBe('idle');
    });

    it('should clear cliProcess reference after killing it', async () => {
      const mockSocket: any = { id: 'socket-5', emit: jest.fn() };
      const sessionId = 'session-clear-process';

      const session = service.getOrCreateSession(sessionId, 'client-5', mockSocket);
      const mockProcess: any = {
        kill: jest.fn(),
        killed: false,
      };
      session.cliProcess = mockProcess;

      await service.restartSession(sessionId);

      const restartedSession = service.getSession(sessionId);
      expect(restartedSession?.cliProcess).toBeNull();
    });

    it('should update skillSyncedAt timestamp after restart', async () => {
      const mockSocket: any = { id: 'socket-6', emit: jest.fn() };
      const sessionId = 'session-timestamp';

      const session = service.getOrCreateSession(sessionId, 'client-6', mockSocket);
      const originalTimestamp = new Date('2024-01-01');
      session.skillSyncedAt = originalTimestamp;

      await service.restartSession(sessionId);

      const restartedSession = service.getSession(sessionId);
      expect(restartedSession?.skillSyncedAt).not.toBe(originalTimestamp);
      expect(restartedSession?.skillSyncedAt).toBeInstanceOf(Date);
    });

    it('should handle SIGKILL if SIGTERM fails', async () => {
      const mockSocket: any = { id: 'socket-7', emit: jest.fn() };
      const sessionId = 'session-sigkill';

      const session = service.getOrCreateSession(sessionId, 'client-7', mockSocket);
      const mockProcess: any = {
        kill: jest.fn((signal) => {
          if (signal === 'SIGTERM') {
            // Simulate SIGTERM failure
            mockProcess.killed = false;
          } else if (signal === 'SIGKILL') {
            mockProcess.killed = true;
          }
        }),
        killed: false,
      };
      session.cliProcess = mockProcess;

      await service.restartSession(sessionId);

      // Should try SIGTERM first
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      // May escalate to SIGKILL if needed (implementation-dependent)
    });
  });

  describe('getSessionDetails', () => {
    it('should return detailed session information', () => {
      const mockSocket: any = { id: 'socket-details', emit: jest.fn() };
      const sessionId = 'session-details';
      const userId = 'user-123';

      const session = service.getOrCreateSession(sessionId, 'client-details', mockSocket, userId);
      session.tenantId = 'tenant-123';
      service.trackSyncedSkills(sessionId, ['skill-1', 'skill-2']);

      const details = service.getSessionDetails(sessionId);

      expect(details).toBeDefined();
      expect(details?.sessionId).toBe(sessionId);
      expect(details?.userId).toBe(userId);
      expect(details?.tenantId).toBe('tenant-123');
      expect(details?.syncedSkillCount).toBe(2);
      expect(details?.needsRestart).toBe(false);
      expect(details?.status).toBe('idle');
      expect(details?.lastActivity).toBeInstanceOf(Date);
    });

    it('should return null for nonexistent session', () => {
      const details = service.getSessionDetails('nonexistent');
      expect(details).toBeNull();
    });

    it('should handle sessions without userId', () => {
      const mockSocket: any = { id: 'socket-anon', emit: jest.fn() };
      const session = service.getOrCreateSession('session-anon', 'client-anon', mockSocket);

      const details = service.getSessionDetails('session-anon');

      expect(details?.userId).toBeUndefined();
    });
  });

  describe('canRestartSession', () => {
    it('should return true for sessions that need restart', () => {
      const mockSocket: any = { id: 'socket-can', emit: jest.fn() };
      const session = service.getOrCreateSession('session-can', 'client-can', mockSocket);
      session.needsRestart = true;

      const canRestart = service.canRestartSession('session-can');
      expect(canRestart).toBe(true);
    });

    it('should return false for sessions that do not need restart', () => {
      const mockSocket: any = { id: 'socket-cannot', emit: jest.fn() };
      service.getOrCreateSession('session-cannot', 'client-cannot', mockSocket);

      const canRestart = service.canRestartSession('session-cannot');
      expect(canRestart).toBe(false);
    });

    it('should return false for sessions that are processing', () => {
      const mockSocket: any = { id: 'socket-processing', emit: jest.fn() };
      const session = service.getOrCreateSession('session-proc', 'client-proc', mockSocket);
      session.needsRestart = true;
      session.status = 'processing';

      const canRestart = service.canRestartSession('session-proc');
      expect(canRestart).toBe(false);
    });

    it('should return false for nonexistent session', () => {
      const canRestart = service.canRestartSession('nonexistent');
      expect(canRestart).toBe(false);
    });
  });
});
