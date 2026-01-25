/**
 * Admin Dashboard Controller
 *
 * Provides aggregated metrics for the admin dashboard.
 */

import { Controller, Get, Query } from '@nestjs/common';
import { Auth, TenantId } from '../../auth/decorators';
import { SessionService } from '../../chat/session.service';
import { AnalyticsService } from '../services/analytics.service';
import { SessionManagerService } from '../services/session-manager.service';
import { SkillsService } from '../../skills/skills.service';
import { ApiKeyService } from '../../auth/api-key.service';
import { DashboardSummary, RecentSession } from '../dto/admin.dto';

@Controller('api/v1/admin/dashboard')
@Auth('admin')
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
  async getSummary(@TenantId() tenantId: string): Promise<DashboardSummary> {
    const [
      sessionStats,
      messages24h,
      tokens24h,
      errorRate24h,
      skills,
    ] = await Promise.all([
      this.sessionService.getStats(),
      this.analyticsService.getMessagesCount24h(),
      this.analyticsService.getTotalTokens24h(),
      this.sessionManagerService.getErrorRate24h(),
      this.skillsService.findAll(tenantId, { page: 1, limit: 1 }),
    ]);

    // Get active API keys count
    const apiKeys = await this.apiKeyService.findByTenantId(tenantId);
    const activeApiKeys = apiKeys.filter((k) => k.status === 'active').length;

    // Get published skills count
    const publishedSkills = await this.skillsService.findPublished(tenantId);

    return {
      activeSessions: sessionStats.processingSessions,
      totalSessions: sessionStats.totalSessions,
      maxSessions: sessionStats.maxSessions,
      totalMessages24h: messages24h,
      totalTokens24h: tokens24h,
      errorRate24h,
      activeApiKeys,
      totalSkills: skills.total,
      publishedSkills: publishedSkills.length,
    };
  }

  /**
   * GET /api/v1/admin/dashboard/recent-sessions
   *
   * Get recent sessions for dashboard
   */
  @Get('recent-sessions')
  async getRecentSessions(
    @Query('limit') limit?: string,
  ): Promise<RecentSession[]> {
    return this.sessionManagerService.getRecentSessions(
      limit ? parseInt(limit, 10) : 10,
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
