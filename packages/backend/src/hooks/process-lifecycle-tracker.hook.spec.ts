/**
 * Process Lifecycle Tracker Hook Tests
 *
 * Tests for tenantId propagation in process lifecycle tracking.
 */

import { createProcessLifecycleTracker, ProcessLifecycleTrackerDeps } from './process-lifecycle-tracker.hook';
import type { ProcessLifecycleService } from '../messages/process-lifecycle.service';
import type { ManagedSession } from '../common/interfaces';

describe('ProcessLifecycleTrackerHook', () => {
  let tracker: ReturnType<typeof createProcessLifecycleTracker>;
  let mockProcessLifecycleService: jest.Mocked<ProcessLifecycleService>;
  let mockGetSession: jest.Mock;
  let mockSession: ManagedSession;

  beforeEach(() => {
    mockProcessLifecycleService = {
      recordSpawn: jest.fn().mockResolvedValue({}),
      recordExit: jest.fn().mockResolvedValue({}),
      recordCrash: jest.fn().mockResolvedValue({}),
      recordKill: jest.fn().mockResolvedValue({}),
    } as any;

    mockSession = {
      sessionId: 'session-123',
      clientId: 'client-123',
      cliProcess: null,
      stdin: null,
      socket: null,
      lastActivity: new Date(),
      status: 'processing',
      createdAt: new Date(),
      messageCount: 5,
      buffer: '',
      workspaceDir: '/tmp/session-123',
      tenantId: 'tenant-process',
    };

    mockGetSession = jest.fn().mockReturnValue(mockSession);

    const deps: ProcessLifecycleTrackerDeps = {
      processLifecycleService: mockProcessLifecycleService,
      getSession: mockGetSession,
    };

    tracker = createProcessLifecycleTracker(deps);
  });

  describe('onSpawn', () => {
    it('should pass tenantId from session to recordSpawn', async () => {
      await tracker.onSpawn('session-123', 12345, 'npx claude-code', '/workspace');

      expect(mockProcessLifecycleService.recordSpawn).toHaveBeenCalledWith(
        'session-123',
        12345,
        'npx claude-code',
        '/workspace',
        'tenant-process',
      );
    });

    it('should pass null tenantId when session has no tenantId', async () => {
      mockSession.tenantId = undefined;

      await tracker.onSpawn('session-123', 12345);

      expect(mockProcessLifecycleService.recordSpawn).toHaveBeenCalledWith(
        'session-123',
        12345,
        undefined,
        undefined,
        null,
      );
    });

    it('should pass null tenantId when session not found', async () => {
      mockGetSession.mockReturnValue(undefined);

      await tracker.onSpawn('session-123', 12345);

      expect(mockProcessLifecycleService.recordSpawn).toHaveBeenCalledWith(
        'session-123',
        12345,
        undefined,
        undefined,
        null,
      );
    });

    it('should handle recordSpawn errors gracefully', async () => {
      mockProcessLifecycleService.recordSpawn = jest.fn().mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(tracker.onSpawn('session-123', 12345)).resolves.not.toThrow();
    });

    it('should pass all parameters to recordSpawn', async () => {
      await tracker.onSpawn('session-123', 12345, 'npx claude-code --resume', '/home/user/project');

      expect(mockProcessLifecycleService.recordSpawn).toHaveBeenCalledWith(
        'session-123',
        12345,
        'npx claude-code --resume',
        '/home/user/project',
        'tenant-process',
      );
    });
  });

  describe('onExit', () => {
    it('should pass tenantId from session to recordExit', async () => {
      await tracker.onExit('session-123', 12345, 0, 'SIGTERM');

      expect(mockProcessLifecycleService.recordExit).toHaveBeenCalledWith(
        'session-123',
        12345,
        0,
        'SIGTERM',
        'tenant-process',
      );
    });

    it('should pass null tenantId when session has no tenantId', async () => {
      mockSession.tenantId = undefined;

      await tracker.onExit('session-123', 12345, 0);

      expect(mockProcessLifecycleService.recordExit).toHaveBeenCalledWith(
        'session-123',
        12345,
        0,
        undefined,
        null,
      );
    });

    it('should pass null tenantId when session not found', async () => {
      mockGetSession.mockReturnValue(undefined);

      await tracker.onExit('session-123', 12345, 1);

      expect(mockProcessLifecycleService.recordExit).toHaveBeenCalledWith(
        'session-123',
        12345,
        1,
        undefined,
        null,
      );
    });

    it('should handle null pid and exit code', async () => {
      await tracker.onExit('session-123', null, null, 'SIGKILL');

      expect(mockProcessLifecycleService.recordExit).toHaveBeenCalledWith(
        'session-123',
        null,
        null,
        'SIGKILL',
        'tenant-process',
      );
    });

    it('should handle recordExit errors gracefully', async () => {
      mockProcessLifecycleService.recordExit = jest.fn().mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(tracker.onExit('session-123', 12345, 0)).resolves.not.toThrow();
    });
  });

  describe('onCrash', () => {
    it('should pass tenantId from session to recordCrash', async () => {
      await tracker.onCrash('session-123', 12345, 'Segmentation fault', 'stderr output');

      expect(mockProcessLifecycleService.recordCrash).toHaveBeenCalledWith(
        'session-123',
        12345,
        'Segmentation fault',
        'stderr output',
        'tenant-process',
      );
    });

    it('should pass null tenantId when session has no tenantId', async () => {
      mockSession.tenantId = undefined;

      await tracker.onCrash('session-123', 12345, 'Error');

      expect(mockProcessLifecycleService.recordCrash).toHaveBeenCalledWith(
        'session-123',
        12345,
        'Error',
        undefined,
        null,
      );
    });

    it('should pass null tenantId when session not found', async () => {
      mockGetSession.mockReturnValue(undefined);

      await tracker.onCrash('session-123', 12345, 'Error');

      expect(mockProcessLifecycleService.recordCrash).toHaveBeenCalledWith(
        'session-123',
        12345,
        'Error',
        undefined,
        null,
      );
    });

    it('should handle null pid', async () => {
      await tracker.onCrash('session-123', null, 'Unknown error');

      expect(mockProcessLifecycleService.recordCrash).toHaveBeenCalledWith(
        'session-123',
        null,
        'Unknown error',
        undefined,
        'tenant-process',
      );
    });

    it('should handle recordCrash errors gracefully', async () => {
      mockProcessLifecycleService.recordCrash = jest.fn().mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(tracker.onCrash('session-123', 12345, 'Error')).resolves.not.toThrow();
    });
  });

  describe('onKill', () => {
    it('should pass tenantId from session to recordKill', async () => {
      await tracker.onKill('session-123', 12345, 'SIGTERM');

      expect(mockProcessLifecycleService.recordKill).toHaveBeenCalledWith(
        'session-123',
        12345,
        'SIGTERM',
        'tenant-process',
      );
    });

    it('should pass null tenantId when session has no tenantId', async () => {
      mockSession.tenantId = undefined;

      await tracker.onKill('session-123', 12345);

      expect(mockProcessLifecycleService.recordKill).toHaveBeenCalledWith(
        'session-123',
        12345,
        'SIGTERM',
        null,
      );
    });

    it('should pass null tenantId when session not found', async () => {
      mockGetSession.mockReturnValue(undefined);

      await tracker.onKill('session-123', 12345);

      expect(mockProcessLifecycleService.recordKill).toHaveBeenCalledWith(
        'session-123',
        12345,
        'SIGTERM',
        null,
      );
    });

    it('should use default SIGTERM signal when not provided', async () => {
      await tracker.onKill('session-123', 12345);

      expect(mockProcessLifecycleService.recordKill).toHaveBeenCalledWith(
        'session-123',
        12345,
        'SIGTERM',
        'tenant-process',
      );
    });

    it('should use custom signal when provided', async () => {
      await tracker.onKill('session-123', 12345, 'SIGKILL');

      expect(mockProcessLifecycleService.recordKill).toHaveBeenCalledWith(
        'session-123',
        12345,
        'SIGKILL',
        'tenant-process',
      );
    });

    it('should handle null pid', async () => {
      await tracker.onKill('session-123', null, 'SIGTERM');

      expect(mockProcessLifecycleService.recordKill).toHaveBeenCalledWith(
        'session-123',
        null,
        'SIGTERM',
        'tenant-process',
      );
    });

    it('should handle recordKill errors gracefully', async () => {
      mockProcessLifecycleService.recordKill = jest.fn().mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(tracker.onKill('session-123', 12345)).resolves.not.toThrow();
    });
  });

  describe('tenantId edge cases', () => {
    it('should handle empty string tenantId', async () => {
      mockSession.tenantId = '';

      await tracker.onSpawn('session-123', 12345);

      // Empty string is falsy, should become null
      expect(mockProcessLifecycleService.recordSpawn).toHaveBeenCalledWith(
        'session-123',
        12345,
        undefined,
        undefined,
        null,
      );
    });

    it('should preserve tenantId across different lifecycle events', async () => {
      await tracker.onSpawn('session-123', 12345, 'npx claude-code', '/workspace');
      await tracker.onExit('session-123', 12345, 0, 'SIGTERM');

      expect(mockProcessLifecycleService.recordSpawn).toHaveBeenCalledWith(
        'session-123',
        12345,
        'npx claude-code',
        '/workspace',
        'tenant-process',
      );
      expect(mockProcessLifecycleService.recordExit).toHaveBeenCalledWith(
        'session-123',
        12345,
        0,
        'SIGTERM',
        'tenant-process',
      );
    });

    it('should handle UUID tenantId format', async () => {
      mockSession.tenantId = '123e4567-e89b-12d3-a456-426614174000';

      await tracker.onSpawn('session-123', 12345);

      expect(mockProcessLifecycleService.recordSpawn).toHaveBeenCalledWith(
        'session-123',
        12345,
        undefined,
        undefined,
        '123e4567-e89b-12d3-a456-426614174000',
      );
    });

    it('should handle slug tenantId format', async () => {
      mockSession.tenantId = 'my-company-tenant';

      await tracker.onSpawn('session-123', 12345);

      expect(mockProcessLifecycleService.recordSpawn).toHaveBeenCalledWith(
        'session-123',
        12345,
        undefined,
        undefined,
        'my-company-tenant',
      );
    });
  });

  describe('complete lifecycle flow', () => {
    it('should track complete process lifecycle with tenantId', async () => {
      // Spawn
      await tracker.onSpawn('session-123', 12345, 'npx claude-code', '/workspace');

      expect(mockProcessLifecycleService.recordSpawn).toHaveBeenCalledWith(
        'session-123',
        12345,
        'npx claude-code',
        '/workspace',
        'tenant-process',
      );

      // Normal exit
      await tracker.onExit('session-123', 12345, 0);

      expect(mockProcessLifecycleService.recordExit).toHaveBeenCalledWith(
        'session-123',
        12345,
        0,
        undefined,
        'tenant-process',
      );
    });

    it('should track crash lifecycle with tenantId', async () => {
      // Spawn
      await tracker.onSpawn('session-123', 12345, 'npx claude-code', '/workspace');

      // Crash
      await tracker.onCrash('session-123', 12345, 'Out of memory', 'Error: ENOMEM');

      expect(mockProcessLifecycleService.recordCrash).toHaveBeenCalledWith(
        'session-123',
        12345,
        'Out of memory',
        'Error: ENOMEM',
        'tenant-process',
      );
    });

    it('should track killed process with tenantId', async () => {
      // Spawn
      await tracker.onSpawn('session-123', 12345, 'npx claude-code', '/workspace');

      // Kill
      await tracker.onKill('session-123', 12345, 'SIGKILL');

      expect(mockProcessLifecycleService.recordKill).toHaveBeenCalledWith(
        'session-123',
        12345,
        'SIGKILL',
        'tenant-process',
      );
    });
  });
});
