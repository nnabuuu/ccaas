/**
 * Analytics Service Tests
 *
 * Tests for multi-tenancy filtering in analytics queries.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { TokenUsageEvent } from '../../messages/entities/token-usage-event.entity';
import { Message } from '../../messages/entities/message.entity';
import { ApiKey } from '../../auth/entities/api-key.entity';
import { Skill } from '../../skills/entities/skill.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let tokenUsageRepository: jest.Mocked<Repository<TokenUsageEvent>>;
  let messageRepository: jest.Mocked<Repository<Message>>;
  let apiKeyRepository: jest.Mocked<Repository<ApiKey>>;
  let skillRepository: jest.Mocked<Repository<Skill>>;
  let tenantRepository: jest.Mocked<Repository<Tenant>>;

  // Mock query builder
  const createMockQueryBuilder = () => {
    const mockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
      getCount: jest.fn().mockResolvedValue(0),
    };
    return mockQb as unknown as jest.Mocked<SelectQueryBuilder<any>>;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(TokenUsageEvent),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ApiKey),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Skill),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    tokenUsageRepository = module.get(getRepositoryToken(TokenUsageEvent));
    messageRepository = module.get(getRepositoryToken(Message));
    apiKeyRepository = module.get(getRepositoryToken(ApiKey));
    skillRepository = module.get(getRepositoryToken(Skill));
    tenantRepository = module.get(getRepositoryToken(Tenant));
  });

  describe('getTokenUsage', () => {
    it('should not filter by tenantId when not provided', async () => {
      const mockQb = createMockQueryBuilder();
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getTokenUsage({ days: 7 });

      expect(mockQb.where).toHaveBeenCalledWith(
        'usage.createdAt BETWEEN :start AND :end',
        expect.any(Object),
      );
      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });

    it('should filter by tenantId when provided', async () => {
      const mockQb = createMockQueryBuilder();
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const tenantId = 'tenant-123';
      await service.getTokenUsage({ days: 7, tenantId });

      expect(mockQb.where).toHaveBeenCalledWith(
        'usage.createdAt BETWEEN :start AND :end',
        expect.any(Object),
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'usage.tenantId = :tenantId',
        { tenantId },
      );
    });

    it('should aggregate token usage correctly', async () => {
      const mockUsageEvents = [
        {
          inputTokens: 100,
          outputTokens: 50,
          cachedInputTokens: 20,
          reasoningTokens: 10,
          createdAt: new Date(),
        },
        {
          inputTokens: 200,
          outputTokens: 100,
          cachedInputTokens: 30,
          reasoningTokens: 20,
          createdAt: new Date(),
        },
      ];

      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue(mockUsageEvents as TokenUsageEvent[]);
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getTokenUsage({ days: 1 });

      expect(result.summary.totalInput).toBe(300);
      expect(result.summary.totalOutput).toBe(150);
      expect(result.summary.totalTokens).toBe(450);
      expect(result.summary.totalCached).toBe(50);
      expect(result.summary.totalReasoning).toBe(30);
    });

    it('should handle null token values gracefully', async () => {
      const mockUsageEvents = [
        {
          inputTokens: null,
          outputTokens: null,
          cachedInputTokens: null,
          reasoningTokens: null,
          createdAt: new Date(),
        },
      ];

      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue(mockUsageEvents as any);
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getTokenUsage({ days: 1 });

      expect(result.summary.totalInput).toBe(0);
      expect(result.summary.totalOutput).toBe(0);
      expect(result.summary.totalTokens).toBe(0);
    });
  });

  describe('getCostBreakdown', () => {
    it('should not filter by tenantId when not provided', async () => {
      const mockTokenQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockTokenQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      await service.getCostBreakdown({ days: 30 });

      // Token usage query should not have tenantId filter
      expect(mockTokenQb.andWhere).not.toHaveBeenCalledWith(
        'usage.tenantId = :tenantId',
        expect.any(Object),
      );
      // Message query should not have tenantId filter
      expect(mockMessageQb.andWhere).not.toHaveBeenCalledWith(
        'message.tenantId = :tenantId',
        expect.any(Object),
      );
    });

    it('should filter by tenantId when provided', async () => {
      const mockTokenQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockTokenQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      const tenantId = 'tenant-456';
      await service.getCostBreakdown({ days: 30, tenantId });

      expect(mockTokenQb.andWhere).toHaveBeenCalledWith(
        'usage.tenantId = :tenantId',
        { tenantId },
      );
      expect(mockMessageQb.andWhere).toHaveBeenCalledWith(
        'message.tenantId = :tenantId',
        { tenantId },
      );
    });

    it('should calculate cost breakdown by tenant', async () => {
      const mockUsageByTenant = [
        { tenantId: 'tenant-1', inputTokens: '1000000', outputTokens: '500000', cachedTokens: '100000' },
        { tenantId: 'tenant-2', inputTokens: '2000000', outputTokens: '1000000', cachedTokens: '200000' },
      ];

      const mockTenants = [
        { id: 'tenant-1', name: 'Tenant One' },
        { id: 'tenant-2', name: 'Tenant Two' },
      ];

      const mockTokenQb = createMockQueryBuilder();
      mockTokenQb.getRawMany.mockResolvedValue(mockUsageByTenant);
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockTokenQb);

      const mockMessageQb = createMockQueryBuilder();
      mockMessageQb.getRawMany.mockResolvedValue([]);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      tenantRepository.find = jest.fn().mockResolvedValue(mockTenants);

      const result = await service.getCostBreakdown({ days: 30 });

      expect(result.byTenant).toHaveLength(2);
      expect(result.byTenant[0].tenantId).toBe('tenant-1');
      expect(result.byTenant[0].tenantName).toBe('Tenant One');
      expect(result.byTenant[0].inputTokens).toBe(1000000);
      expect(result.byTenant[1].tenantId).toBe('tenant-2');
      expect(result.byTenant[1].tenantName).toBe('Tenant Two');
    });

    it('should handle unknown tenant gracefully', async () => {
      const mockUsageByTenant = [
        { tenantId: 'unknown-tenant', inputTokens: '1000', outputTokens: '500', cachedTokens: '100' },
      ];

      const mockTokenQb = createMockQueryBuilder();
      mockTokenQb.getRawMany.mockResolvedValue(mockUsageByTenant);
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockTokenQb);

      const mockMessageQb = createMockQueryBuilder();
      mockMessageQb.getRawMany.mockResolvedValue([]);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      tenantRepository.find = jest.fn().mockResolvedValue([]);

      const result = await service.getCostBreakdown({ days: 30 });

      expect(result.byTenant[0].tenantName).toBe('Unknown');
    });
  });

  describe('getMessagesCount24h', () => {
    it('should not filter by tenantId when not provided', async () => {
      const mockQb = createMockQueryBuilder();
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getMessagesCount24h();

      expect(mockQb.where).toHaveBeenCalledWith(
        'message.createdAt >= :oneDayAgo',
        expect.any(Object),
      );
      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });

    it('should filter by tenantId when provided', async () => {
      const mockQb = createMockQueryBuilder();
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const tenantId = 'tenant-789';
      await service.getMessagesCount24h(tenantId);

      expect(mockQb.where).toHaveBeenCalledWith(
        'message.createdAt >= :oneDayAgo',
        expect.any(Object),
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'message.tenantId = :tenantId',
        { tenantId },
      );
    });

    it('should return correct message count', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(42);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const count = await service.getMessagesCount24h();

      expect(count).toBe(42);
    });
  });

  describe('getTotalTokens24h', () => {
    it('should not filter by tenantId when not provided', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({ input: '0', output: '0' });
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getTotalTokens24h();

      expect(mockQb.where).toHaveBeenCalledWith(
        'usage.createdAt >= :oneDayAgo',
        expect.any(Object),
      );
      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });

    it('should filter by tenantId when provided', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({ input: '0', output: '0' });
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const tenantId = 'tenant-abc';
      await service.getTotalTokens24h(tenantId);

      expect(mockQb.where).toHaveBeenCalledWith(
        'usage.createdAt >= :oneDayAgo',
        expect.any(Object),
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'usage.tenantId = :tenantId',
        { tenantId },
      );
    });

    it('should return correct token totals', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({ input: '5000', output: '2500' });
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getTotalTokens24h();

      expect(result.input).toBe(5000);
      expect(result.output).toBe(2500);
      expect(result.total).toBe(7500);
    });

    it('should handle null values gracefully', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getRawOne.mockResolvedValue({ input: null, output: null });
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getTotalTokens24h();

      expect(result.input).toBe(0);
      expect(result.output).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getApiKeyUsage', () => {
    it('should not filter by tenantId when not provided', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      apiKeyRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getApiKeyUsage();

      expect(mockQb.where).not.toHaveBeenCalled();
    });

    it('should filter by tenantId when provided', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      apiKeyRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const tenantId = 'tenant-xyz';
      await service.getApiKeyUsage(tenantId);

      expect(mockQb.where).toHaveBeenCalledWith(
        'key.tenantId = :tenantId',
        { tenantId },
      );
    });

    it('should return formatted API key stats', async () => {
      const mockApiKeys = [
        {
          id: 'key-1',
          keyPrefix: 'sk_1234',
          name: 'Test Key',
          tenantId: 'tenant-1',
          usageCount: 100,
          lastUsedAt: new Date(),
        },
      ];

      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue(mockApiKeys);
      apiKeyRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getApiKeyUsage();

      expect(result).toHaveLength(1);
      expect(result[0].apiKeyId).toBe('key-1');
      expect(result[0].keyPrefix).toBe('sk_1234');
      expect(result[0].requestCount).toBe(100);
    });
  });
});
