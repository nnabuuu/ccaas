/**
 * Quota Service
 *
 * Manages tenant token quotas: creation, checking, incrementing, and periodic reset.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SolutionQuota } from './entities/solution-quota.entity';
import { PLAN_DEFAULT_TOKEN_QUOTA, TenantPlan } from '../solutions/entities/solution.entity';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  resetsAt: string;
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    @InjectRepository(SolutionQuota)
    private readonly quotaRepository: Repository<SolutionQuota>,
  ) {}

  /**
   * Get or create the monthly quota for a tenant.
   * If the period has expired, resets usage and advances the period.
   */
  async getOrCreateQuota(solutionId: string, plan: TenantPlan): Promise<SolutionQuota> {
    let quota = await this.quotaRepository.findOne({
      where: { solutionId, period: 'monthly' },
    });

    if (!quota) {
      quota = await this.createDefaultQuota(solutionId, plan);
    } else if (new Date(quota.periodEnd) < new Date()) {
      quota = await this.resetQuota(quota);
    }

    return quota;
  }

  /**
   * Check whether a tenant is within their token quota.
   * Returns allowed=true if maxTokens === -1 (unlimited/BYOK).
   */
  async checkQuota(solutionId: string, plan: TenantPlan): Promise<QuotaCheckResult> {
    const quota = await this.getOrCreateQuota(solutionId, plan);

    // -1 = unlimited (BYOK plan)
    if (quota.maxTokens === -1) {
      return {
        allowed: true,
        remaining: -1,
        limit: -1,
        used: quota.currentTokens,
        resetsAt: quota.periodEnd.toISOString(),
      };
    }

    const remaining = Math.max(0, quota.maxTokens - quota.currentTokens);
    return {
      allowed: quota.currentTokens < quota.maxTokens,
      remaining,
      limit: quota.maxTokens,
      used: quota.currentTokens,
      resetsAt: quota.periodEnd.toISOString(),
    };
  }

  /**
   * Atomically increment token usage for a tenant's monthly quota.
   * Logs a warning when the alert threshold is crossed.
   */
  async incrementTokenUsage(solutionId: string, tokens: number): Promise<void> {
    // Atomic update to avoid race conditions
    const result = await this.quotaRepository
      .createQueryBuilder()
      .update(SolutionQuota)
      .set({ currentTokens: () => `currentTokens + ${Math.round(tokens)}` })
      .where('solutionId = :solutionId AND period = :period', {
        solutionId,
        period: 'monthly',
      })
      .execute();

    if (result.affected === 0) {
      this.logger.warn(`No quota record found for tenant ${solutionId}, skipping increment`);
      return;
    }

    // Check alert threshold (non-blocking)
    const quota = await this.quotaRepository.findOne({
      where: { solutionId, period: 'monthly' },
    });
    if (quota && quota.maxTokens > 0) {
      const usagePercent = (quota.currentTokens / quota.maxTokens) * 100;
      if (usagePercent >= quota.alertThreshold) {
        this.logger.warn(
          `Solution ${solutionId} quota alert: ${quota.currentTokens}/${quota.maxTokens} tokens ` +
            `(${Math.round(usagePercent)}% used, threshold: ${quota.alertThreshold}%)`,
        );
      }
    }
  }

  /**
   * Reset all expired quotas. Runs hourly via cron.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async resetExpiredQuotas(): Promise<number> {
    const now = new Date();
    const expired = await this.quotaRepository.find({
      where: { periodEnd: LessThan(now) },
    });

    if (expired.length === 0) return 0;

    for (const quota of expired) {
      await this.resetQuota(quota);
    }

    this.logger.log(`Reset ${expired.length} expired quota(s)`);
    return expired.length;
  }

  // =========================================================================
  // Internal Helpers
  // =========================================================================

  /**
   * Create a default monthly quota for a tenant based on their plan.
   */
  async createDefaultQuota(solutionId: string, plan: TenantPlan): Promise<SolutionQuota> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const maxTokens = PLAN_DEFAULT_TOKEN_QUOTA[plan];

    const quota = this.quotaRepository.create({
      solutionId,
      period: 'monthly',
      maxTokens,
      maxSessions: 0, // not enforced
      maxApiCalls: 0, // not enforced
      currentTokens: 0,
      currentSessions: 0,
      currentApiCalls: 0,
      alertThreshold: 80,
      periodStart,
      periodEnd,
    });

    const saved = await this.quotaRepository.save(quota);
    this.logger.log(
      `Created default quota for tenant ${solutionId}: ` +
        `maxTokens=${maxTokens === -1 ? 'unlimited' : maxTokens}`,
    );
    return saved;
  }

  /**
   * Reset a quota record for the next period.
   */
  private async resetQuota(quota: SolutionQuota): Promise<SolutionQuota> {
    const now = new Date();
    quota.currentTokens = 0;
    quota.currentSessions = 0;
    quota.currentApiCalls = 0;
    quota.periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    quota.periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const saved = await this.quotaRepository.save(quota);
    this.logger.log(`Reset quota for tenant ${quota.solutionId}`);
    return saved;
  }
}
