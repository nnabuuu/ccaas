/**
 * Quota Service Tests
 *
 * Tests for tenant token quota management:
 * - getOrCreateQuota: auto-creation, period reset
 * - checkQuota: unlimited vs limited plans
 * - incrementTokenUsage: atomic updates, alert threshold
 * - resetExpiredQuotas: batch reset
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuotaService } from './quota.service';
import { SolutionQuota } from './entities/solution-quota.entity';

describe('QuotaService', () => {
  let service: QuotaService;
  let quotaRepository: jest.Mocked<Repository<SolutionQuota>>;

  const mockQueryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaService,
        {
          provide: getRepositoryToken(SolutionQuota),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<QuotaService>(QuotaService);
    quotaRepository = module.get(getRepositoryToken(SolutionQuota));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // getOrCreateQuota
  // =========================================================================

  describe('getOrCreateQuota', () => {
    it('should return existing quota if found and not expired', async () => {
      const existingQuota: Partial<SolutionQuota> = {
        id: 'q1',
        solutionId: 't1',
        period: 'monthly',
        maxTokens: 200_000,
        currentTokens: 50_000,
        periodEnd: new Date(Date.now() + 86400000), // future
      };
      quotaRepository.findOne.mockResolvedValue(existingQuota as SolutionQuota);

      const result = await service.getOrCreateQuota('t1', 'free');

      expect(result).toEqual(existingQuota);
      expect(quotaRepository.create).not.toHaveBeenCalled();
    });

    it('should create default quota when none exists', async () => {
      quotaRepository.findOne.mockResolvedValue(null);
      const newQuota: Partial<SolutionQuota> = {
        id: 'q-new',
        solutionId: 't1',
        maxTokens: 200_000,
        currentTokens: 0,
      };
      quotaRepository.create.mockReturnValue(newQuota as SolutionQuota);
      quotaRepository.save.mockResolvedValue(newQuota as SolutionQuota);

      const result = await service.getOrCreateQuota('t1', 'free');

      expect(quotaRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          solutionId: 't1',
          period: 'monthly',
          maxTokens: 200_000,
          currentTokens: 0,
        }),
      );
      expect(result).toEqual(newQuota);
    });

    it('should create unlimited quota for starter plan', async () => {
      quotaRepository.findOne.mockResolvedValue(null);
      const newQuota: Partial<SolutionQuota> = {
        id: 'q-new',
        solutionId: 't1',
        maxTokens: -1,
        currentTokens: 0,
      };
      quotaRepository.create.mockReturnValue(newQuota as SolutionQuota);
      quotaRepository.save.mockResolvedValue(newQuota as SolutionQuota);

      await service.getOrCreateQuota('t1', 'starter');

      expect(quotaRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: -1,
        }),
      );
    });

    it('should reset quota when period has expired', async () => {
      const expiredQuota: Partial<SolutionQuota> = {
        id: 'q1',
        solutionId: 't1',
        period: 'monthly',
        maxTokens: 200_000,
        currentTokens: 150_000,
        currentSessions: 10,
        currentApiCalls: 100,
        periodEnd: new Date(Date.now() - 86400000), // past
      };
      quotaRepository.findOne.mockResolvedValue(expiredQuota as SolutionQuota);
      quotaRepository.save.mockImplementation(async (q) => q as SolutionQuota);

      const result = await service.getOrCreateQuota('t1', 'free');

      expect(result.currentTokens).toBe(0);
      expect(result.currentSessions).toBe(0);
      expect(result.currentApiCalls).toBe(0);
    });
  });

  // =========================================================================
  // checkQuota
  // =========================================================================

  describe('checkQuota', () => {
    it('should allow unlimited plan (maxTokens === -1)', async () => {
      const quota: Partial<SolutionQuota> = {
        id: 'q1',
        solutionId: 't1',
        maxTokens: -1,
        currentTokens: 999_999,
        periodEnd: new Date(Date.now() + 86400000),
      };
      quotaRepository.findOne.mockResolvedValue(quota as SolutionQuota);

      const result = await service.checkQuota('t1', 'starter');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1);
      expect(result.limit).toBe(-1);
    });

    it('should allow when under quota', async () => {
      const quota: Partial<SolutionQuota> = {
        id: 'q1',
        solutionId: 't1',
        maxTokens: 200_000,
        currentTokens: 100_000,
        periodEnd: new Date(Date.now() + 86400000),
      };
      quotaRepository.findOne.mockResolvedValue(quota as SolutionQuota);

      const result = await service.checkQuota('t1', 'free');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100_000);
      expect(result.limit).toBe(200_000);
      expect(result.used).toBe(100_000);
    });

    it('should deny when at or over quota', async () => {
      const quota: Partial<SolutionQuota> = {
        id: 'q1',
        solutionId: 't1',
        maxTokens: 200_000,
        currentTokens: 200_456,
        periodEnd: new Date(Date.now() + 86400000),
      };
      quotaRepository.findOne.mockResolvedValue(quota as SolutionQuota);

      const result = await service.checkQuota('t1', 'free');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.used).toBe(200_456);
      expect(result.resetsAt).toBeDefined();
    });
  });

  // =========================================================================
  // incrementTokenUsage
  // =========================================================================

  describe('incrementTokenUsage', () => {
    it('should atomically increment currentTokens', async () => {
      mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });
      quotaRepository.findOne.mockResolvedValue({
        maxTokens: 200_000,
        currentTokens: 50_000,
        alertThreshold: 80,
      } as SolutionQuota);

      await service.incrementTokenUsage('t1', 2500);

      expect(quotaRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        currentTokens: expect.any(Function),
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'solutionId = :solutionId AND period = :period',
        { solutionId: 't1', period: 'monthly' },
      );
    });

    it('should warn when no quota record found', async () => {
      mockQueryBuilder.execute.mockResolvedValue({ affected: 0 });

      await service.incrementTokenUsage('t1', 1000);

      // Should not throw, just skip
      expect(quotaRepository.findOne).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // resetExpiredQuotas
  // =========================================================================

  describe('resetExpiredQuotas', () => {
    it('should reset all expired quotas', async () => {
      const expired = [
        {
          id: 'q1',
          solutionId: 't1',
          currentTokens: 150_000,
          currentSessions: 10,
          currentApiCalls: 50,
          periodEnd: new Date(Date.now() - 86400000),
        },
        {
          id: 'q2',
          solutionId: 't2',
          currentTokens: 100_000,
          currentSessions: 5,
          currentApiCalls: 20,
          periodEnd: new Date(Date.now() - 86400000),
        },
      ] as SolutionQuota[];

      quotaRepository.find.mockResolvedValue(expired);
      quotaRepository.save.mockImplementation(async (q) => q as SolutionQuota);

      const count = await service.resetExpiredQuotas();

      expect(count).toBe(2);
      expect(quotaRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no expired quotas', async () => {
      quotaRepository.find.mockResolvedValue([]);

      const count = await service.resetExpiredQuotas();

      expect(count).toBe(0);
      expect(quotaRepository.save).not.toHaveBeenCalled();
    });
  });
});
