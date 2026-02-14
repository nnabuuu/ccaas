/**
 * Admin Sessions Controller Tests
 *
 * Tests for the admin sessions REST API endpoints.
 * Verifies pagination contract: { data, total, page, pageSize }
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminSessionsController } from './admin-sessions.controller';
import { SessionManagerService, PaginatedSessions } from '../services/session-manager.service';
import { SessionQueryDto, SessionListItem } from '../dto/admin.dto';
import { ApiKeyService } from '../../auth/api-key.service';

describe('AdminSessionsController', () => {
  let controller: AdminSessionsController;
  let sessionManagerService: jest.Mocked<SessionManagerService>;

  const createMockSessionItem = (
    sessionId: string,
    overrides: Partial<SessionListItem> = {},
  ): SessionListItem => ({
    sessionId,
    tenantId: 'tenant-a',
    clientId: `client-${sessionId}`,
    status: 'idle',
    messageCount: 5,
    totalTokens: 1000,
    estimatedCost: 0.05,
    createdAt: new Date(),
    lastActivity: new Date(),
    hasActiveProcess: false,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSessionsController],
      providers: [
        {
          provide: SessionManagerService,
          useValue: {
            getSessions: jest.fn(),
            getActiveSessions: jest.fn(),
            getSessionDetail: jest.fn(),
            getSessionTimeline: jest.fn(),
            getTokenBreakdown: jest.fn(),
            killSession: jest.fn(),
            bulkKillSessions: jest.fn(),
          },
        },
        {
          provide: ApiKeyService,
          useValue: {
            validateApiKey: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminSessionsController>(AdminSessionsController);
    sessionManagerService = module.get(SessionManagerService);
  });

  describe('GET /api/v1/admin/sessions', () => {
    it('should return PaginatedSessions with data, total, page, pageSize', async () => {
      const mockResult: PaginatedSessions = {
        data: [createMockSessionItem('s1'), createMockSessionItem('s2')],
        total: 100,
        page: 1,
        pageSize: 50,
      };
      sessionManagerService.getSessions = jest.fn().mockResolvedValue(mockResult);

      const query: SessionQueryDto = { page: 1, pageSize: 50 };
      const result = await controller.getSessions(query);

      expect(result).toEqual(mockResult);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it('should pass query parameters to service', async () => {
      sessionManagerService.getSessions = jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        pageSize: 25,
      });

      const query: SessionQueryDto = {
        tenantId: 'tenant-a',
        status: 'processing',
        page: 2,
        pageSize: 25,
      };
      await controller.getSessions(query);

      expect(sessionManagerService.getSessions).toHaveBeenCalledWith(query);
    });

    it('should support legacy offset/limit parameters', async () => {
      sessionManagerService.getSessions = jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      const query: SessionQueryDto = { offset: 0, limit: 20 };
      await controller.getSessions(query);

      expect(sessionManagerService.getSessions).toHaveBeenCalledWith(query);
    });
  });

  describe('GET /api/v1/admin/sessions/:sessionId', () => {
    it('should return session detail', async () => {
      const detail = {
        ...createMockSessionItem('s1'),
        workspaceDir: '/tmp/s1',
      };
      sessionManagerService.getSessionDetail = jest.fn().mockResolvedValue(detail);

      const result = await controller.getSessionDetail('s1');

      expect(result).toEqual(detail);
    });

    it('should throw NotFoundException when session not found', async () => {
      sessionManagerService.getSessionDetail = jest.fn().mockResolvedValue(null);

      await expect(controller.getSessionDetail('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /api/v1/admin/sessions/:sessionId/kill', () => {
    it('should return success when kill succeeds', async () => {
      sessionManagerService.killSession = jest.fn().mockResolvedValue(true);

      const ctx = { apiKeyId: 'admin-key', tenantId: 'admin-tenant' } as any;
      const result = await controller.killSession('s1', ctx);

      expect(result.success).toBe(true);
    });

    it('should return failure when kill fails', async () => {
      sessionManagerService.killSession = jest.fn().mockResolvedValue(false);

      const ctx = { apiKeyId: 'admin-key', tenantId: 'admin-tenant' } as any;
      const result = await controller.killSession('s1', ctx);

      expect(result.success).toBe(false);
    });
  });

  describe('POST /api/v1/admin/sessions/bulk-kill', () => {
    it('should return bulk kill results with success/failure counts', async () => {
      const mockResult = {
        totalRequested: 3,
        successCount: 2,
        failedCount: 1,
        results: [
          { sessionId: 's1', status: 'success' as const },
          { sessionId: 's2', status: 'success' as const },
          { sessionId: 's3', status: 'failed' as const, error: 'Session not found' },
        ],
      };
      sessionManagerService.bulkKillSessions = jest.fn().mockResolvedValue(mockResult);

      const ctx = { apiKeyId: 'admin-key', tenantId: 'admin-tenant' } as any;
      const result = await controller.bulkKillSessions(ctx, ['s1', 's2', 's3']);

      expect(result).toEqual(mockResult);
      expect(result.totalRequested).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(sessionManagerService.bulkKillSessions).toHaveBeenCalledWith(
        ['s1', 's2', 's3'],
        'admin-key',
      );
    });

    it('should throw error when sessionIds array is empty', async () => {
      const ctx = { apiKeyId: 'admin-key', tenantId: 'admin-tenant' } as any;

      await expect(controller.bulkKillSessions(ctx, [])).rejects.toThrow(
        'sessionIds must be a non-empty array',
      );
    });

    it('should throw error when sessionIds exceeds 100', async () => {
      const ctx = { apiKeyId: 'admin-key', tenantId: 'admin-tenant' } as any;
      const tooManySessions = Array.from({ length: 101 }, (_, i) => `s${i}`);

      await expect(controller.bulkKillSessions(ctx, tooManySessions)).rejects.toThrow(
        'Cannot terminate more than 100 sessions at once',
      );
    });

    it('should use tenantId as adminId when apiKeyId is not available', async () => {
      const mockResult = {
        totalRequested: 1,
        successCount: 1,
        failedCount: 0,
        results: [{ sessionId: 's1', status: 'success' as const }],
      };
      sessionManagerService.bulkKillSessions = jest.fn().mockResolvedValue(mockResult);

      const ctx = { tenantId: 'tenant-a' } as any; // No apiKeyId
      await controller.bulkKillSessions(ctx, ['s1']);

      expect(sessionManagerService.bulkKillSessions).toHaveBeenCalledWith(['s1'], 'tenant-a');
    });
  });
});
