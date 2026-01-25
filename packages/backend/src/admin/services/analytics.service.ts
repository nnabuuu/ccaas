/**
 * Analytics Service
 *
 * Aggregation queries for token usage, costs, and API key stats.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { TokenUsageEvent } from '../../messages/entities/token-usage-event.entity';
import { Message } from '../../messages/entities/message.entity';
import { ApiKey } from '../../auth/entities/api-key.entity';
import { Skill } from '../../skills/entities/skill.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import {
  AnalyticsQueryDto,
  TokenUsageAnalytics,
  TokenUsageDataPoint,
  CostAnalytics,
  CostBreakdown,
  ApiKeyUsageStats,
} from '../dto/admin.dto';

// Claude pricing (per 1M tokens)
const CLAUDE_PRICING = {
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0, cached: 0.1 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0, cached: 1.5 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0, cached: 0.3 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25, cached: 0.025 },
  default: { input: 3.0, output: 15.0, cached: 0.3 },
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(TokenUsageEvent)
    private readonly tokenUsageRepository: Repository<TokenUsageEvent>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  /**
   * Get token usage analytics
   */
  async getTokenUsage(query: AnalyticsQueryDto): Promise<TokenUsageAnalytics> {
    const { startDate, endDate, days = 7, granularity = 'daily', tenantId } = query;

    // Calculate date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

    const qb = this.tokenUsageRepository
      .createQueryBuilder('usage')
      .select([
        'usage.inputTokens',
        'usage.outputTokens',
        'usage.cachedInputTokens',
        'usage.reasoningTokens',
        'usage.createdAt',
      ])
      .where('usage.createdAt BETWEEN :start AND :end', { start, end });

    if (tenantId) {
      qb.andWhere('usage.tenantId = :tenantId', { tenantId });
    }

    const usageEvents = await qb.getMany();

    // Aggregate by granularity
    const dataPoints = this.aggregateByGranularity(usageEvents, granularity, start, end);

    // Calculate summary
    const summary = usageEvents.reduce(
      (acc, event) => ({
        totalInput: acc.totalInput + (event.inputTokens || 0),
        totalOutput: acc.totalOutput + (event.outputTokens || 0),
        totalTokens:
          acc.totalTokens + (event.inputTokens || 0) + (event.outputTokens || 0),
        totalCached: acc.totalCached + (event.cachedInputTokens || 0),
        totalReasoning: acc.totalReasoning + (event.reasoningTokens || 0),
        count: acc.count + 1,
      }),
      { totalInput: 0, totalOutput: 0, totalTokens: 0, totalCached: 0, totalReasoning: 0, count: 0 },
    );

    return {
      dataPoints,
      summary: {
        ...summary,
        avgPerSession: summary.count > 0 ? Math.round(summary.totalTokens / summary.count) : 0,
      },
    };
  }

  /**
   * Get cost breakdown by tenant, model, and skill
   */
  async getCostBreakdown(query: AnalyticsQueryDto): Promise<CostAnalytics> {
    const { startDate, endDate, days = 30, tenantId } = query;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

    // Get usage grouped by tenant
    const usageByTenantQb = this.tokenUsageRepository
      .createQueryBuilder('usage')
      .select('usage.tenantId', 'tenantId')
      .addSelect('SUM(usage.inputTokens)', 'inputTokens')
      .addSelect('SUM(usage.outputTokens)', 'outputTokens')
      .addSelect('SUM(usage.cachedInputTokens)', 'cachedTokens')
      .where('usage.createdAt BETWEEN :start AND :end', { start, end });

    if (tenantId) {
      usageByTenantQb.andWhere('usage.tenantId = :tenantId', { tenantId });
    }

    const usageByTenant = await usageByTenantQb
      .groupBy('usage.tenantId')
      .getRawMany();

    // Get tenant names
    const tenants = await this.tenantRepository.find();
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

    // Calculate total tokens for percentage
    const totalTokens = usageByTenant.reduce(
      (sum, row) => sum + (parseInt(row.inputTokens) || 0) + (parseInt(row.outputTokens) || 0),
      0,
    );

    const byTenant: CostBreakdown[] = usageByTenant.map((row) => {
      const inputTokens = parseInt(row.inputTokens) || 0;
      const outputTokens = parseInt(row.outputTokens) || 0;
      const cachedTokens = parseInt(row.cachedTokens) || 0;
      const estimatedCost = this.calculateCost(inputTokens, outputTokens, cachedTokens);

      return {
        tenantId: row.tenantId || 'unknown',
        tenantName: tenantMap.get(row.tenantId) || 'Unknown',
        inputTokens,
        outputTokens,
        cachedTokens,
        estimatedCost,
        percentage: totalTokens > 0 ? ((inputTokens + outputTokens) / totalTokens) * 100 : 0,
      };
    });

    // Get usage by model (from message metadata)
    const usageByModelQb = this.messageRepository
      .createQueryBuilder('message')
      .select("json_extract(message.metadata, '$.model')", 'model')
      .addSelect("SUM(json_extract(message.metadata, '$.inputTokens'))", 'inputTokens')
      .addSelect("SUM(json_extract(message.metadata, '$.outputTokens'))", 'outputTokens')
      .where('message.createdAt BETWEEN :start AND :end', { start, end })
      .andWhere("json_extract(message.metadata, '$.model') IS NOT NULL");

    if (tenantId) {
      usageByModelQb.andWhere('message.tenantId = :tenantId', { tenantId });
    }

    const usageByModel = await usageByModelQb
      .groupBy("json_extract(message.metadata, '$.model')")
      .getRawMany();

    const byModel = usageByModel.map((row) => {
      const model = row.model || 'unknown';
      const inputTokens = parseInt(row.inputTokens) || 0;
      const outputTokens = parseInt(row.outputTokens) || 0;
      return {
        model,
        inputTokens,
        outputTokens,
        estimatedCost: this.calculateCost(inputTokens, outputTokens, 0, model),
      };
    });

    // Calculate total cost
    const totalEstimatedCost = byTenant.reduce((sum, t) => sum + t.estimatedCost, 0);

    return {
      byTenant,
      byModel,
      bySkill: [], // TODO: Implement skill-level tracking
      totalEstimatedCost,
    };
  }

  /**
   * Get API key usage stats
   */
  async getApiKeyUsage(tenantId?: string): Promise<ApiKeyUsageStats[]> {
    const qb = this.apiKeyRepository
      .createQueryBuilder('key')
      .select([
        'key.id',
        'key.keyPrefix',
        'key.name',
        'key.tenantId',
        'key.usageCount',
        'key.lastUsedAt',
      ]);

    if (tenantId) {
      qb.where('key.tenantId = :tenantId', { tenantId });
    }

    const keys = await qb.getMany();

    return keys.map((key) => ({
      apiKeyId: key.id,
      keyPrefix: key.keyPrefix,
      name: key.name,
      tenantId: key.tenantId,
      requestCount: key.usageCount,
      lastUsedAt: key.lastUsedAt,
      rateLimitHits: 0, // TODO: Track rate limit hits
      errorCount: 0, // TODO: Track error count per key
    }));
  }

  /**
   * Get messages count in last 24 hours
   */
  async getMessagesCount24h(tenantId?: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .where('message.createdAt >= :oneDayAgo', { oneDayAgo });

    if (tenantId) {
      qb.andWhere('message.tenantId = :tenantId', { tenantId });
    }

    return qb.getCount();
  }

  /**
   * Get total tokens in last 24 hours
   */
  async getTotalTokens24h(tenantId?: string): Promise<{ input: number; output: number; total: number }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const qb = this.tokenUsageRepository
      .createQueryBuilder('usage')
      .select('SUM(usage.inputTokens)', 'input')
      .addSelect('SUM(usage.outputTokens)', 'output')
      .where('usage.createdAt >= :oneDayAgo', { oneDayAgo });

    if (tenantId) {
      qb.andWhere('usage.tenantId = :tenantId', { tenantId });
    }

    const result = await qb.getRawOne();

    const input = parseInt(result?.input) || 0;
    const output = parseInt(result?.output) || 0;

    return { input, output, total: input + output };
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private aggregateByGranularity(
    events: TokenUsageEvent[],
    granularity: 'hourly' | 'daily' | 'weekly' | 'monthly',
    start: Date,
    end: Date,
  ): TokenUsageDataPoint[] {
    const buckets = new Map<string, TokenUsageDataPoint>();

    // Create empty buckets
    let current = new Date(start);
    while (current <= end) {
      const key = this.getBucketKey(current, granularity);
      buckets.set(key, {
        timestamp: new Date(current),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedTokens: 0,
        reasoningTokens: 0,
      });
      current = this.incrementBucket(current, granularity);
    }

    // Aggregate events into buckets
    for (const event of events) {
      const key = this.getBucketKey(event.createdAt, granularity);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.inputTokens += event.inputTokens || 0;
        bucket.outputTokens += event.outputTokens || 0;
        bucket.totalTokens += (event.inputTokens || 0) + (event.outputTokens || 0);
        bucket.cachedTokens += event.cachedInputTokens || 0;
        bucket.reasoningTokens += event.reasoningTokens || 0;
      }
    }

    return Array.from(buckets.values());
  }

  private getBucketKey(date: Date, granularity: 'hourly' | 'daily' | 'weekly' | 'monthly'): string {
    const d = new Date(date);
    switch (granularity) {
      case 'hourly':
        d.setMinutes(0, 0, 0);
        return d.toISOString();
      case 'daily':
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split('T')[0];
      case 'weekly':
        const dayOfWeek = d.getDay();
        d.setDate(d.getDate() - dayOfWeek);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split('T')[0];
      case 'monthly':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      default:
        return d.toISOString();
    }
  }

  private incrementBucket(
    date: Date,
    granularity: 'hourly' | 'daily' | 'weekly' | 'monthly',
  ): Date {
    const d = new Date(date);
    switch (granularity) {
      case 'hourly':
        d.setHours(d.getHours() + 1);
        break;
      case 'daily':
        d.setDate(d.getDate() + 1);
        break;
      case 'weekly':
        d.setDate(d.getDate() + 7);
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 1);
        break;
    }
    return d;
  }

  private calculateCost(
    inputTokens: number,
    outputTokens: number,
    cachedTokens: number,
    model?: string,
  ): number {
    const pricing = CLAUDE_PRICING[model as keyof typeof CLAUDE_PRICING] || CLAUDE_PRICING.default;

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    const cachedCost = (cachedTokens / 1_000_000) * pricing.cached;

    return Math.round((inputCost + outputCost + cachedCost) * 100) / 100;
  }
}
