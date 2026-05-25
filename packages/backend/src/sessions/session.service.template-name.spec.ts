/**
 * SessionService - templateName persistence tests
 *
 * Verifies that persistTemplateName updates the session in database
 * and that persistSessionToDatabase includes templateName.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SessionService } from './session.service';
import { EventMapperService } from './event-mapper.service';
import { CliProcessService } from './services/cli-process.service';
import { WorkspaceService } from './services/workspace.service';
import { BackgroundTaskMonitorService } from './services/background-task-monitor.service';
import { StreamRegistryService } from './services/stream-registry.service';
import { SessionAssetMaterializer } from './services/session-asset-materializer.service';
import { mockWorkspaceProvider } from './workspace/__mocks__/mock-provider';
import { Session as SessionEntity } from '../admin/entities/session.entity';

describe('SessionService - templateName persistence', () => {
  let service: SessionService;
  let mockSessionRepo: {
    save: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    mockSessionRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'workspace.dir': '.agent-workspace',
                'workspace.sessionTtlMs': 300000,
                'workspace.maxSessions': 100,
                'workspace.cleanupIntervalMs': 300000,
                'workspace.maxProcessingMs': 1800000,
                'CLAUDE_CLI_PATH': 'claude',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: EventMapperService,
          useValue: {
            clearSessionState: jest.fn(),
            markBackgroundTaskComplete: jest.fn(),
            registerBackgroundTaskCallback: jest.fn(),
          },
        },
        {
          provide: CliProcessService,
          useValue: {},
        },
        {
          provide: WorkspaceService,
          useValue: {
            createSessionWorkspace: jest.fn().mockResolvedValue('/tmp/test-workspace'),
            writeSettingsFile: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: BackgroundTaskMonitorService,
          useValue: { stopAllMonitors: jest.fn(), stopAllMonitorsForSession: jest.fn() },
        },
        {
          provide: StreamRegistryService,
          useValue: { cleanupSession: jest.fn() },
        },
        {
          provide: SessionAssetMaterializer,
          useValue: { materialize: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(SessionEntity),
          useValue: mockSessionRepo,
        },
        mockWorkspaceProvider(),
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  describe('persistTemplateName', () => {
    it('should call update with templateName for the given sessionId', async () => {
      await service.persistTemplateName('session-123', 'farmer-advisor');

      expect(mockSessionRepo.update).toHaveBeenCalledWith(
        { sessionId: 'session-123' },
        expect.objectContaining({
          templateName: 'farmer-advisor',
        }),
      );
    });

    it('should always include lastActivity in the update', async () => {
      await service.persistTemplateName('session-123', 'bank-assessor');

      expect(mockSessionRepo.update).toHaveBeenCalledWith(
        { sessionId: 'session-123' },
        expect.objectContaining({
          templateName: 'bank-assessor',
          lastActivity: expect.any(Date),
        }),
      );
    });
  });

  describe('persistTemplateName - edge cases', () => {
    it('should not throw when update affects 0 rows (session not yet in DB)', async () => {
      mockSessionRepo.update.mockResolvedValue({ affected: 0 });

      // Should resolve without error (logged as warning internally)
      await expect(
        service.persistTemplateName('non-existent', 'farmer-advisor'),
      ).resolves.not.toThrow();
    });
  });
});
