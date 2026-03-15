/**
 * Token Usage Service
 *
 * Tracks token usage per API call for cost analysis and optimization.
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenUsageEvent, ContextWindowUsage } from './entities/token-usage-event.entity';
import { QuotaService } from '../admin/quota.service';

// Model pricing per 1M tokens (as of 2025)
const MODEL_PRICING: Record<string, { input: number; output: number; cached: number }> = {
  'claude-opus-4-5-20251101': { input: 15, output: 75, cached: 1.5 },
  'claude-opus-4.5': { input: 15, output: 75, cached: 1.5 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, cached: 0.3 },
  'claude-sonnet-4': { input: 3, output: 15, cached: 0.3 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4, cached: 0.08 },
  'claude-haiku-3.5': { input: 0.8, output: 4, cached: 0.08 },
};

export interface CreateTokenUsageDto {
  messageId: string;
  sessionId: string;
  tenantId?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  reasoningTokens?: number;
  contextWindowUsage?: ContextWindowUsage | null;
  stopReason?: string | null;
  apiMessageId?: string | null;
}

@Injectable()
export class TokenUsageService {
  private readonly logger = new Logger(TokenUsageService.name);

  constructor(
    @InjectRepository(TokenUsageEvent)
    private readonly usageRepository: Repository<TokenUsageEvent>,
    @Optional() @Inject(QuotaService)
    private readonly quotaService?: QuotaService,
  ) {}

  /**
   * Record a token usage event
   */
  async recordUsage(dto: CreateTokenUsageDto): Promise<TokenUsageEvent> {
    const estimatedCostUsd = this.calculateCost(
      dto.model,
      dto.inputTokens,
      dto.outputTokens,
      dto.cachedInputTokens || 0,
    );

    const event = this.usageRepository.create({
      messageId: dto.messageId,
      sessionId: dto.sessionId,
      tenantId: dto.tenantId ?? undefined,
      model: dto.model,
      inputTokens: dto.inputTokens,
      outputTokens: dto.outputTokens,
      cachedInputTokens: dto.cachedInputTokens ?? 0,
      cacheReadTokens: dto.cacheReadTokens ?? 0,
      cacheCreationTokens: dto.cacheCreationTokens ?? 0,
      reasoningTokens: dto.reasoningTokens ?? 0,
      contextWindowUsage: dto.contextWindowUsage ?? null,
      stopReason: dto.stopReason ?? null,
      apiMessageId: dto.apiMessageId ?? null,
      estimatedCostUsd,
    });

    const saved = await this.usageRepository.save(event);
    this.logger.debug(
      `Recorded token usage for message ${dto.messageId}: ` +
        `in=${dto.inputTokens}, out=${dto.outputTokens}, cached=${dto.cachedInputTokens || 0}`,
    );

    // Update tenant quota (fire-and-forget, non-critical path)
    if (dto.tenantId && this.quotaService) {
      const totalTokens = dto.inputTokens + dto.outputTokens;
      this.quotaService.incrementTokenUsage(dto.tenantId, totalTokens).catch((err) =>
        this.logger.warn(`Failed to update quota for tenant ${dto.tenantId}: ${err}`),
      );
    }

    return saved;
  }

  /**
   * Calculate estimated cost in USD
   */
  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cachedTokens: number,
  ): number {
    // Find pricing for model (try full name, then base name)
    let pricing = MODEL_PRICING[model];
    if (!pricing) {
      // Try to match base model name
      const baseModel = Object.keys(MODEL_PRICING).find((m) =>
        model.toLowerCase().includes(m.toLowerCase().replace(/-\d+$/, '')),
      );
      pricing = baseModel ? MODEL_PRICING[baseModel] : MODEL_PRICING['claude-sonnet-4'];
    }

    const billableInputTokens = Math.max(0, inputTokens - cachedTokens);
    const inputCost = (billableInputTokens / 1_000_000) * pricing.input;
    const cachedCost = (cachedTokens / 1_000_000) * pricing.cached;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return Math.round((inputCost + cachedCost + outputCost) * 1_000_000) / 1_000_000;
  }

  /**
   * Get token usage events by message ID
   */
  async getByMessageId(messageId: string): Promise<TokenUsageEvent[]> {
    return this.usageRepository.find({
      where: { messageId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get token usage events by session ID
   */
  async getBySessionId(sessionId: string): Promise<TokenUsageEvent[]> {
    return this.usageRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get session usage summary
   */
  async getSessionSummary(sessionId: string): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    totalReasoningTokens: number;
    totalCostUsd: number;
    requestCount: number;
    cacheHitRate: number;
    modelBreakdown: Record<string, {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    }>;
    averageContextUsage: number | null;
  }> {
    const events = await this.getBySessionId(sessionId);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedTokens = 0;
    let totalReasoningTokens = 0;
    let totalCostUsd = 0;
    let totalContextUsage = 0;
    let contextUsageCount = 0;

    const modelBreakdown: Record<string, {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    }> = {};

    for (const event of events) {
      totalInputTokens += event.inputTokens;
      totalOutputTokens += event.outputTokens;
      totalCachedTokens += event.cachedInputTokens;
      totalReasoningTokens += event.reasoningTokens;
      totalCostUsd += event.estimatedCostUsd || 0;

      if (event.contextWindowUsage?.percentFull != null) {
        totalContextUsage += event.contextWindowUsage.percentFull;
        contextUsageCount++;
      }

      if (!modelBreakdown[event.model]) {
        modelBreakdown[event.model] = {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
        };
      }
      modelBreakdown[event.model].requests++;
      modelBreakdown[event.model].inputTokens += event.inputTokens;
      modelBreakdown[event.model].outputTokens += event.outputTokens;
      modelBreakdown[event.model].costUsd += event.estimatedCostUsd || 0;
    }

    const cacheHitRate = totalInputTokens > 0
      ? Math.round((totalCachedTokens / totalInputTokens) * 100) / 100
      : 0;

    return {
      totalInputTokens,
      totalOutputTokens,
      totalCachedTokens,
      totalReasoningTokens,
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      requestCount: events.length,
      cacheHitRate,
      modelBreakdown,
      averageContextUsage: contextUsageCount > 0
        ? Math.round((totalContextUsage / contextUsageCount) * 100) / 100
        : null,
    };
  }

  /**
   * Get usage by model for a tenant
   */
  async getTenantUsageByModel(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Array<{
    model: string;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
    requestCount: number;
  }>> {
    const qb = this.usageRepository
      .createQueryBuilder('usage')
      .where('usage.tenantId = :tenantId', { tenantId })
      .select('usage.model', 'model')
      .addSelect('SUM(usage.inputTokens)', 'totalInputTokens')
      .addSelect('SUM(usage.outputTokens)', 'totalOutputTokens')
      .addSelect('SUM(usage.estimatedCostUsd)', 'totalCostUsd')
      .addSelect('COUNT(*)', 'requestCount')
      .groupBy('usage.model');

    if (startDate) {
      qb.andWhere('usage.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('usage.createdAt <= :endDate', { endDate });
    }

    return qb.getRawMany();
  }

  /**
   * Delete all usage events for a session
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    const result = await this.usageRepository.delete({ sessionId });
    return result.affected || 0;
  }
}
