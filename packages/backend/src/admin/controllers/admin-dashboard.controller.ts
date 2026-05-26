/**
 * Admin Dashboard Controller
 *
 * Provides aggregated metrics for the admin dashboard.
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthAdminOrBuilder, Ctx } from '../../auth/decorators';
import { RequestContext } from '../../auth/types';
import { AdminSolutionAccessGuard, isAdminScope } from '../guards/admin-solution-access.guard';
import { SessionService } from '../../sessions/session.service';
import { AnalyticsService } from '../services/analytics.service';
import { SessionManagerService } from '../services/session-manager.service';
import { SkillsService } from '../../skills/skills.service';
import { ApiKeyService } from '../../auth/api-key.service';
import { DashboardSummary, RecentSession } from '../dto/admin.dto';

@ApiTags('admin')
@Controller('api/v1/admin/dashboard')
@AuthAdminOrBuilder()
@UseGuards(AdminSolutionAccessGuard)
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
    @Query('solutionId') solutionId: string | undefined,
    @Ctx() ctx: RequestContext,
  ): Promise<DashboardSummary> {
    // Builder keys: always enforce own-tenant (defense-in-depth, guard also validates)
    if (!isAdminScope(ctx)) {
      solutionId = ctx.solutionId;
    }
    const [
      sessionStats,
      messages24h,
      tokens24h,
      errorRate24h,
    ] = await Promise.all([
      this.sessionService.getStats(solutionId),
      this.analyticsService.getMessagesCount24h(solutionId),
      this.analyticsService.getTotalTokens24h(solutionId),
      this.sessionManagerService.getErrorRate24h(solutionId),
    ]);

    // Get skills and API keys count (tenant-scoped if solutionId provided)
    let totalSkills = 0;
    let publishedSkillsCount = 0;
    let activeApiKeys = 0;

    if (solutionId) {
      const [skills, publishedSkills, apiKeys] = await Promise.all([
        this.skillsService.findAll(solutionId, { page: 1, limit: 1 }),
        this.skillsService.findPublished(solutionId),
        this.apiKeyService.findByTenantId(solutionId),
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
    @Query('solutionId') solutionId: string | undefined,
    @Ctx() ctx: RequestContext,
  ): Promise<RecentSession[]> {
    // Builder keys: always enforce own-tenant (defense-in-depth, guard also validates)
    if (!isAdminScope(ctx)) {
      solutionId = ctx.solutionId;
    }
    return this.sessionManagerService.getRecentSessions(
      limit ? parseInt(limit, 10) : 10,
      solutionId,
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
