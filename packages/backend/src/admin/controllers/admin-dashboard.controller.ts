/**
 * Admin Dashboard Controller
 *
 * Provides aggregated metrics for the admin dashboard.
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthAdminOrBuilder, Ctx } from '../../auth/decorators';
import { RequestContext } from '../../auth/types';
import { AdminTenantAccessGuard, isAdminScope } from '../guards/admin-tenant-access.guard';
import { SessionService } from '../../sessions/session.service';
import { AnalyticsService } from '../services/analytics.service';
import { SessionManagerService } from '../services/session-manager.service';
import { SkillsService } from '../../skills/skills.service';
import { ApiKeyService } from '../../auth/api-key.service';
import { DashboardSummary, RecentSession } from '../dto/admin.dto';

@Controller('api/v1/admin/dashboard')
@AuthAdminOrBuilder()
@UseGuards(AdminTenantAccessGuard)
export class AdminDashboardController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly analyticsService: AnalyticsService,
    private readonly sessionManagerService: SessionManagerService,
    private readonly skillsService: SkillsService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  /**
   * GET /api/v1/admin/dashboard/summary
   *
   * Get dashboard summary metrics
   */
  @Get('summary')
  async getSummary(
    @Query('tenantId') tenantId: string | undefined,
    @Ctx() ctx: RequestContext,
  ): Promise<DashboardSummary> {
    // Builder keys: always enforce own-tenant (defense-in-depth, guard also validates)
    if (!isAdminScope(ctx)) {
      tenantId = ctx.tenantId;
    }
    const [
      sessionStats,
      messages24h,
      tokens24h,
      errorRate24h,
    ] = await Promise.all([
      this.sessionService.getStats(tenantId),
      this.analyticsService.getMessagesCount24h(tenantId),
      this.analyticsService.getTotalTokens24h(tenantId),
      this.sessionManagerService.getErrorRate24h(tenantId),
    ]);

    // Get skills and API keys count (tenant-scoped if tenantId provided)
    let totalSkills = 0;
    let publishedSkillsCount = 0;
    let activeApiKeys = 0;

    if (tenantId) {
      const [skills, publishedSkills, apiKeys] = await Promise.all([
        this.skillsService.findAll(tenantId, { page: 1, limit: 1 }),
        this.skillsService.findPublished(tenantId),
        this.apiKeyService.findByTenantId(tenantId),
      ]);
      totalSkills = skills.total;
      publishedSkillsCount = publishedSkills.length;
      activeApiKeys = apiKeys.filter((k) => k.status === 'active').length;
    }

    return {
      activeSessions: sessionStats.processingSessions,
      totalSessions: sessionStats.totalSessions,
      maxSessions: sessionStats.maxSessions,
      totalMessages24h: messages24h,
      totalTokens24h: tokens24h,
      errorRate24h,
      activeApiKeys,
      totalSkills,
      publishedSkills: publishedSkillsCount,
      callerScope: isAdminScope(ctx) ? 'admin' : 'builder',
    };
  }

  /**
   * GET /api/v1/admin/dashboard/recent-sessions
   *
   * Get recent sessions for dashboard
   */
  @Get('recent-sessions')
  async getRecentSessions(
    @Query('limit') limit: string | undefined,
    @Query('tenantId') tenantId: string | undefined,
    @Ctx() ctx: RequestContext,
  ): Promise<RecentSession[]> {
    // Builder keys: always enforce own-tenant (defense-in-depth, guard also validates)
    if (!isAdminScope(ctx)) {
      tenantId = ctx.tenantId;
    }
    return this.sessionManagerService.getRecentSessions(
      limit ? parseInt(limit, 10) : 10,
      tenantId,
    );
  }

  /**
   * GET /api/v1/admin/dashboard/health
   *
   * Health check for admin dashboard
   */
  @Get('health')
  async getHealth(): Promise<{ status: string; timestamp: Date }> {
    return {
      status: 'ok',
      timestamp: new Date(),
    };
  }
}
