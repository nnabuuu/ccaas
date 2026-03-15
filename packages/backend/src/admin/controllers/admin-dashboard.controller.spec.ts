/**
 * Admin Dashboard Controller Tests
 *
 * Tests for multi-tenancy query parameter handling.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardController } from './admin-dashboard.controller';
import { SessionService } from '../../sessions/session.service';
import { AnalyticsService } from '../services/analytics.service';
import { SessionManagerService } from '../services/session-manager.service';
import { SkillsService } from '../../skills/skills.service';
import { ApiKeyService } from '../../auth/api-key.service';
import { UserTenantService } from '../../users/user-tenant.service';
import type { RequestContext } from '../../auth/types';

describe('AdminDashboardController', () => {
  const adminCtx = {
    tenantId: 'admin-tenant',
    apiKeyScopes: ['admin'],
    requestId: 'req-1',
    timestamp: new Date(),
  } as unknown as RequestContext;

  let controller: AdminDashboardController;
  let sessionService: jest.Mocked<SessionService>;
  let analyticsService: jest.Mocked<AnalyticsService>;
  let sessionManagerService: jest.Mocked<SessionManagerService>;
  let skillsService: jest.Mocked<SkillsService>;
  let apiKeyService: jest.Mocked<ApiKeyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [
        {
          provide: SessionService,
          useValue: {
            getStats: jest.fn().mockReturnValue({
              processingSessions: 3,
              totalSessions: 10,
              maxSessions: 100,
            }),
          },
        },
        {
          provide: AnalyticsService,
          useValue: {
            getMessagesCount24h: jest.fn().mockResolvedValue(50),
            getTotalTokens24h: jest.fn().mockResolvedValue({
              input: 10000,
              output: 5000,
              total: 15000,
            }),
          },
        },
        {
          provide: SessionManagerService,
          useValue: {
            getErrorRate24h: jest.fn().mockResolvedValue(0.025), // Decimal format (2.5% = 0.025)
            getRecentSessions: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: SkillsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
            findPublished: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: ApiKeyService,
          useValue: {
            findByTenantId: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: UserTenantService,
          useValue: {
            findUserInTenant: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminDashboardController>(AdminDashboardController);
    sessionService = module.get(SessionService);
    analyticsService = module.get(AnalyticsService);
    sessionManagerService = module.get(SessionManagerService);
    skillsService = module.get(SkillsService);
    apiKeyService = module.get(ApiKeyService);
  });

  describe('getSummary', () => {
    it('should call analytics services without tenantId when not provided', async () => {
      await controller.getSummary(undefined, adminCtx);

      expect(sessionService.getStats).toHaveBeenCalledWith(undefined);
      expect(analyticsService.getMessagesCount24h).toHaveBeenCalledWith(undefined);
      expect(analyticsService.getTotalTokens24h).toHaveBeenCalledWith(undefined);
      expect(sessionManagerService.getErrorRate24h).toHaveBeenCalledWith(undefined);
    });

    it('should pass tenantId to analytics services when provided', async () => {
      const tenantId = 'tenant-123';
      await controller.getSummary(tenantId, adminCtx);

      expect(sessionService.getStats).toHaveBeenCalledWith(tenantId);
      expect(analyticsService.getMessagesCount24h).toHaveBeenCalledWith(tenantId);
      expect(analyticsService.getTotalTokens24h).toHaveBeenCalledWith(tenantId);
      expect(sessionManagerService.getErrorRate24h).toHaveBeenCalledWith(tenantId);
    });

    it('should fetch tenant-scoped skills and API keys when tenantId provided', async () => {
      const tenantId = 'tenant-456';
      skillsService.findAll = jest.fn().mockResolvedValue({ items: [], total: 5 });
      skillsService.findPublished = jest.fn().mockResolvedValue([{}, {}]);
      apiKeyService.findByTenantId = jest.fn().mockResolvedValue([
        { status: 'active' },
        { status: 'active' },
        { status: 'revoked' },
      ]);

      const result = await controller.getSummary(tenantId, adminCtx);

      expect(skillsService.findAll).toHaveBeenCalledWith(tenantId, { page: 1, limit: 1 });
      expect(skillsService.findPublished).toHaveBeenCalledWith(tenantId);
      expect(apiKeyService.findByTenantId).toHaveBeenCalledWith(tenantId);

      expect(result.totalSkills).toBe(5);
      expect(result.publishedSkills).toBe(2);
      expect(result.activeApiKeys).toBe(2);
    });

    it('should return zero counts for skills and API keys when no tenantId', async () => {
      const result = await controller.getSummary(undefined, adminCtx);

      expect(skillsService.findAll).not.toHaveBeenCalled();
      expect(skillsService.findPublished).not.toHaveBeenCalled();
      expect(apiKeyService.findByTenantId).not.toHaveBeenCalled();

      expect(result.totalSkills).toBe(0);
      expect(result.publishedSkills).toBe(0);
      expect(result.activeApiKeys).toBe(0);
    });

    it('should return complete dashboard summary structure', async () => {
      const result = await controller.getSummary(undefined, adminCtx);

      expect(result).toEqual({
        activeSessions: 3,
        totalSessions: 10,
        maxSessions: 100,
        totalMessages24h: 50,
        totalTokens24h: {
          input: 10000,
          output: 5000,
          total: 15000,
        },
        errorRate24h: 0.025, // Decimal format (0-1), equivalent to 2.5%
        activeApiKeys: 0,
        totalSkills: 0,
        publishedSkills: 0,
        callerScope: 'admin',
      });
    });

    it('should return callerScope builder for builder context', async () => {
      const builderCtx = {
        tenantId: 'builder-tenant',
        apiKeyScopes: ['builder'],
        requestId: 'req-2',
        timestamp: new Date(),
      } as unknown as RequestContext;

      const result = await controller.getSummary(undefined, builderCtx);

      expect(result.callerScope).toBe('builder');
      // Builder should always use ctx.tenantId
      expect(sessionService.getStats).toHaveBeenCalledWith('builder-tenant');
    });

    it('should ignore explicit tenantId for builder and use ctx.tenantId', async () => {
      const builderCtx = {
        tenantId: 'builder-tenant',
        apiKeyScopes: ['builder'],
        requestId: 'req-3',
        timestamp: new Date(),
      } as unknown as RequestContext;

      // Builder passes a different tenantId — should be ignored (defense-in-depth)
      await controller.getSummary('other-tenant', builderCtx);

      expect(sessionService.getStats).toHaveBeenCalledWith('builder-tenant');
      expect(analyticsService.getMessagesCount24h).toHaveBeenCalledWith('builder-tenant');
    });
  });

  describe('getRecentSessions - builder isolation', () => {
    it('should force ctx.tenantId for builder keys', async () => {
      const builderCtx = {
        tenantId: 'builder-tenant',
        apiKeyScopes: ['builder'],
        requestId: 'req-4',
        timestamp: new Date(),
      } as unknown as RequestContext;

      await controller.getRecentSessions(undefined, undefined, builderCtx);

      expect(sessionManagerService.getRecentSessions).toHaveBeenCalledWith(10, 'builder-tenant');
    });

    it('should ignore explicit tenantId for builder in getRecentSessions', async () => {
      const builderCtx = {
        tenantId: 'builder-tenant',
        apiKeyScopes: ['builder'],
        requestId: 'req-5',
        timestamp: new Date(),
      } as unknown as RequestContext;

      await controller.getRecentSessions(undefined, 'other-tenant', builderCtx);

      expect(sessionManagerService.getRecentSessions).toHaveBeenCalledWith(10, 'builder-tenant');
    });
  });

  describe('getRecentSessions', () => {
    it('should call getRecentSessions without tenantId when not provided', async () => {
      await controller.getRecentSessions(undefined, undefined, adminCtx);

      expect(sessionManagerService.getRecentSessions).toHaveBeenCalledWith(10, undefined);
    });

    it('should pass tenantId to getRecentSessions when provided', async () => {
      const tenantId = 'tenant-789';
      await controller.getRecentSessions(undefined, tenantId, adminCtx);

      expect(sessionManagerService.getRecentSessions).toHaveBeenCalledWith(10, tenantId);
    });

    it('should respect custom limit parameter', async () => {
      await controller.getRecentSessions('25', undefined, adminCtx);

      expect(sessionManagerService.getRecentSessions).toHaveBeenCalledWith(25, undefined);
    });

    it('should pass both limit and tenantId', async () => {
      const tenantId = 'tenant-abc';
      await controller.getRecentSessions('15', tenantId, adminCtx);

      expect(sessionManagerService.getRecentSessions).toHaveBeenCalledWith(15, tenantId);
    });

    it('should return recent sessions from service', async () => {
      const mockSessions = [
        {
          sessionId: 'session-1',
          tenantId: 'tenant-1',
          status: 'idle',
          messageCount: 5,
          createdAt: new Date(),
          lastActivity: new Date(),
        },
      ];

      sessionManagerService.getRecentSessions = jest.fn().mockResolvedValue(mockSessions);

      const result = await controller.getRecentSessions(undefined, undefined, adminCtx);

      expect(result).toEqual(mockSessions);
    });
  });

  describe('getHealth', () => {
    it('should return health status', async () => {
      const result = await controller.getHealth();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });
});
