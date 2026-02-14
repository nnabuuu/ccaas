/**
 * Admin Sessions Controller
 *
 * Session management endpoints for admins.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Auth, Ctx } from '../../auth/decorators';
import { RequestContext } from '../../auth/types';
import { SessionManagerService } from '../services/session-manager.service';
import {
  SessionQueryDto,
  SessionListItem,
  SessionDetail,
  SessionTimeline,
  TokenBreakdown,
} from '../dto/admin.dto';
import { BulkKillDto } from '../dto/bulk-kill.dto';
import { TimelineQueryDto } from '../dto/timeline-query.dto';
import { PaginatedSessions } from '../services/session-manager.service';

@Controller('api/v1/admin/sessions')
@Auth('admin')
export class AdminSessionsController {
  constructor(private readonly sessionManagerService: SessionManagerService) {}

  /**
   * GET /api/v1/admin/sessions
   *
   * List all sessions with filtering and pagination
   */
  @Get()
  async getSessions(@Query() query: SessionQueryDto): Promise<PaginatedSessions> {
    return this.sessionManagerService.getSessions(query);
  }

  /**
   * GET /api/v1/admin/sessions/active
   *
   * Get currently active sessions (processing or with active AgentEngine)
   */
  @Get('active')
  async getActiveSessions(): Promise<SessionListItem[]> {
    return this.sessionManagerService.getActiveSessions();
  }

  /**
   * GET /api/v1/admin/sessions/:sessionId
   *
   * Get session detail
   */
  @Get(':sessionId')
  async getSessionDetail(
    @Param('sessionId') sessionId: string,
    @Ctx() ctx: RequestContext,
  ): Promise<SessionDetail> {
    const session = await this.sessionManagerService.getSessionDetail(
      sessionId,
      ctx.tenantId,
    );
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * GET /api/v1/admin/sessions/:sessionId/timeline
   *
   * Get session timeline with all events (messages, tool calls, thinking, etc.)
   */
  @Get(':sessionId/timeline')
  async getSessionTimeline(
    @Param('sessionId') sessionId: string,
    @Ctx() ctx: RequestContext,
    @Query() query: TimelineQueryDto,
  ): Promise<SessionTimeline> {
    return this.sessionManagerService.getSessionTimeline(
      sessionId,
      query.limit,
      query.offset,
      ctx.tenantId,
    );
  }

  /**
   * GET /api/v1/admin/sessions/:sessionId/tokens
   *
   * Get token usage breakdown for a session
   */
  @Get(':sessionId/tokens')
  async getTokenBreakdown(
    @Param('sessionId') sessionId: string,
    @Ctx() ctx: RequestContext,
  ): Promise<TokenBreakdown> {
    const breakdown = await this.sessionManagerService.getTokenBreakdown(
      sessionId,
      ctx.tenantId,
    );
    if (!breakdown) {
      throw new NotFoundException(`No token data found for session: ${sessionId}`);
    }
    return breakdown;
  }

  /**
   * POST /api/v1/admin/sessions/:sessionId/kill
   *
   * Force terminate a session's AgentEngine process
   */
  @Post(':sessionId/kill')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 kills per minute
  async killSession(
    @Param('sessionId') sessionId: string,
    @Ctx() ctx: RequestContext,
  ): Promise<{ success: boolean; message: string }> {
    const adminId = ctx.apiKeyId || ctx.tenantId;
    const success = await this.sessionManagerService.killSession(
      sessionId,
      adminId,
      ctx.tenantId,
    );

    return {
      success,
      message: success
        ? 'Session terminated successfully'
        : 'Session has no active process to terminate',
    };
  }

  /**
   * POST /api/v1/admin/sessions/:sessionId/restart
   *
   * Restart a session (placeholder - requires additional implementation)
   */
  @Post(':sessionId/restart')
  @HttpCode(HttpStatus.OK)
  async restartSession(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message:
        'Restart requires WebSocket context. Use the chat interface to send a new message to resume the session.',
    };
  }

  /**
   * POST /api/v1/admin/sessions/bulk-kill
   *
   * Bulk terminate multiple sessions
   */
  @Post('bulk-kill')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 bulk operations per minute
  async bulkKillSessions(
    @Ctx() ctx: RequestContext,
    @Body() dto: BulkKillDto,
  ): Promise<{
    totalRequested: number;
    successCount: number;
    failedCount: number;
    results: Array<{
      sessionId: string;
      status: 'success' | 'failed';
      error?: string;
    }>;
  }> {
    const adminId = ctx.apiKeyId || ctx.tenantId;
    return this.sessionManagerService.bulkKillSessions(
      dto.sessionIds,
      adminId,
      ctx.tenantId,
    );
  }
}
