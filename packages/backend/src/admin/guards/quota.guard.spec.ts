/**
 * Quota Guard Tests
 *
 * Tests for the QuotaGuard that enforces token quotas on sendMessage.
 */

import { ExecutionContext } from '@nestjs/common';
import { QuotaGuard } from './quota.guard';
import { QuotaService } from '../quota.service';
import { TenantsService } from '../../tenants/tenants.service';
import { QuotaExceededException } from '../../protocol/http-exceptions';

describe('QuotaGuard', () => {
  let guard: QuotaGuard;
  let quotaService: jest.Mocked<QuotaService>;
  let tenantsService: jest.Mocked<TenantsService>;

  const createMockContext = (body: Record<string, unknown> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ body }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    quotaService = {
      checkQuota: jest.fn(),
    } as any;

    tenantsService = {
      findOne: jest.fn(),
    } as any;

    guard = new QuotaGuard(quotaService, tenantsService);
  });

  it('should allow when no tenantId in body', async () => {
    const ctx = createMockContext({});
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(tenantsService.findOne).not.toHaveBeenCalled();
  });

  it('should allow when tenant not found', async () => {
    tenantsService.findOne.mockResolvedValue(null);
    const ctx = createMockContext({ tenantId: 'unknown' });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(quotaService.checkQuota).not.toHaveBeenCalled();
  });

  it('should allow BYOK tenant (unlimited)', async () => {
    tenantsService.findOne.mockResolvedValue({
      id: 't1',
      slug: 'test',
      plan: 'starter',
    } as any);
    quotaService.checkQuota.mockResolvedValue({
      allowed: true,
      remaining: -1,
      limit: -1,
      used: 5000,
      resetsAt: '2026-04-01T00:00:00.000Z',
    });

    const ctx = createMockContext({ tenantId: 't1' });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should allow free tenant under quota', async () => {
    tenantsService.findOne.mockResolvedValue({
      id: 't1',
      slug: 'test-free',
      plan: 'free',
    } as any);
    quotaService.checkQuota.mockResolvedValue({
      allowed: true,
      remaining: 100_000,
      limit: 200_000,
      used: 100_000,
      resetsAt: '2026-04-01T00:00:00.000Z',
    });

    const ctx = createMockContext({ tenantId: 't1' });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should throw QuotaExceededException when over quota', async () => {
    tenantsService.findOne.mockResolvedValue({
      id: 't1',
      slug: 'test-free',
      plan: 'free',
    } as any);
    quotaService.checkQuota.mockResolvedValue({
      allowed: false,
      remaining: 0,
      limit: 200_000,
      used: 200_456,
      resetsAt: '2026-04-01T00:00:00.000Z',
    });

    const ctx = createMockContext({ tenantId: 't1' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(QuotaExceededException);
  });

  it('should include quota details in the exception', async () => {
    tenantsService.findOne.mockResolvedValue({
      id: 't1',
      slug: 'test-free',
      plan: 'free',
    } as any);
    quotaService.checkQuota.mockResolvedValue({
      allowed: false,
      remaining: 0,
      limit: 200_000,
      used: 200_456,
      resetsAt: '2026-04-01T00:00:00.000Z',
    });

    const ctx = createMockContext({ tenantId: 't1' });

    try {
      await guard.canActivate(ctx);
      fail('Expected QuotaExceededException');
    } catch (err) {
      expect(err).toBeInstanceOf(QuotaExceededException);
      const exc = err as QuotaExceededException;
      expect(exc.quota.limit).toBe(200_000);
      expect(exc.quota.used).toBe(200_456);
      expect(exc.quota.period).toBe('monthly');
      expect(exc.quota.resetsAt).toBe('2026-04-01T00:00:00.000Z');
      expect(exc.getStatus()).toBe(429);
    }
  });
});
