/**
 * Admin Analytics Controller
 *
 * Analytics endpoints for token usage, costs, and API key stats.
 */

import { Controller, Get, Query, Param } from '@nestjs/common';
import { Auth } from '../../auth/decorators';
import { AnalyticsService } from '../services/analytics.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Skill } from '../../skills/entities/skill.entity';
import { TokenUsageEvent } from '../../messages/entities/token-usage-event.entity';
import {
  AnalyticsQueryDto,
  TokenUsageAnalytics,
  CostAnalytics,
  ApiKeyUsageStats,
  ErrorRateTrend,
} from '../dto/admin.dto';

@Controller('api/v1/admin/analytics')
@Auth('admin')
export class AdminAnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(TokenUsageEvent)
    private readonly tokenUsageRepository: Repository<TokenUsageEvent>,
  ) {}

  /**
   * GET /api/v1/admin/analytics/tokens
   *
   * Get token usage analytics over time
   */
  @Get('tokens')
  async getTokenUsage(
    @Query() query: AnalyticsQueryDto,
  ): Promise<TokenUsageAnalytics> {
    return this.analyticsService.getTokenUsage(query);
  }

  /**
   * GET /api/v1/admin/analytics/costs
   *
   * Get cost breakdown by tenant, model, and skill
   */
  @Get('costs')
  async getCostBreakdown(
    @Query() query: AnalyticsQueryDto,
  ): Promise<CostAnalytics> {
    return this.analyticsService.getCostBreakdown(query);
  }

  /**
   * GET /api/v1/admin/analytics/api-keys
   *
   * Get API key usage statistics
   */
  @Get('api-keys')
  async getApiKeyUsage(
    @Query('tenantId') tenantId?: string,
  ): Promise<ApiKeyUsageStats[]> {
    return this.analyticsService.getApiKeyUsage(tenantId);
  }

  /**
   * GET /api/v1/admin/analytics/summary
   *
   * Get analytics summary (quick stats)
   */
  @Get('summary')
  async getSummary(
    @Query('days') days?: string,
  ): Promise<{
    totalTokens: { input: number; output: number; total: number };
    messagesCount: number;
    estimatedCost: number;
  }> {
    const query: AnalyticsQueryDto = { days: days ? parseInt(days, 10) : 7 };

    const [tokens, costs] = await Promise.all([
      this.analyticsService.getTokenUsage(query),
      this.analyticsService.getCostBreakdown(query),
    ]);

    return {
      totalTokens: {
        input: tokens.summary.totalInput,
        output: tokens.summary.totalOutput,
        total: tokens.summary.totalTokens,
      },
      messagesCount: 0,
      estimatedCost: costs.totalEstimatedCost,
    };
  }

  /**
   * GET /api/v1/admin/analytics/skills
   *
   * Get skill usage analytics — how many sessions/tokens each skill has consumed
   */
  @Get('skills')
  async getSkillUsage(
    @Query('tenantId') tenantId?: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    // Get skills for the tenant (or all)
    const whereClause: Record<string, unknown> = {};
    if (tenantId) whereClause.tenantId = tenantId;

    const skills = await this.skillRepository.find({ where: whereClause as any });

    // Get token usage grouped by session (proxy for skill usage)
    const tokenEvents = await this.tokenUsageRepository.find({
      where: {
        createdAt: MoreThanOrEqual(since),
        ...(tenantId ? { tenantId } : {}),
      } as any,
    });

    // Aggregate token usage per session
    const sessionTokens = new Map<string, { input: number; output: number; count: number }>();
    for (const event of tokenEvents) {
      const existing = sessionTokens.get(event.sessionId) || { input: 0, output: 0, count: 0 };
      existing.input += event.inputTokens || 0;
      existing.output += event.outputTokens || 0;
      existing.count += 1;
      sessionTokens.set(event.sessionId, existing);
    }

    return {
      period: { days: daysNum, since: since.toISOString() },
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        tenantId: s.tenantId,
        enabled: s.enabled,
        status: s.status,
      })),
      tokenUsage: {
        totalSessions: sessionTokens.size,
        totalInput: Array.from(sessionTokens.values()).reduce((sum, v) => sum + v.input, 0),
        totalOutput: Array.from(sessionTokens.values()).reduce((sum, v) => sum + v.output, 0),
        totalEvents: tokenEvents.length,
      },
    };
  }

  /**
   * GET /api/v1/admin/analytics/error-rate-trend
   *
   * Get error rate trend over time
   * Returns time series data showing error rates by date/hour/week
   */
  @Get('error-rate-trend')
  async getErrorRateTrend(
    @Query() query: AnalyticsQueryDto,
  ): Promise<ErrorRateTrend> {
    return this.analyticsService.getErrorRateTrend(query);
  }
}
