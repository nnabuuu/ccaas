/**
 * Admin Analytics Controller
 *
 * Analytics endpoints for token usage, costs, and API key stats.
 */

import { Controller, Get, Query } from '@nestjs/common';
import { Auth } from '../../auth/decorators';
import { AnalyticsService } from '../services/analytics.service';
import {
  AnalyticsQueryDto,
  TokenUsageAnalytics,
  CostAnalytics,
  ApiKeyUsageStats,
} from '../dto/admin.dto';

@Controller('api/v1/admin/analytics')
@Auth('admin')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
}
