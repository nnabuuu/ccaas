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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
  ): Promise<SessionDetail> {
    const session = await this.sessionManagerService.getSessionDetail(sessionId);
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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<SessionTimeline> {
    return this.sessionManagerService.getSessionTimeline(
      sessionId,
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
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
  ): Promise<TokenBreakdown> {
    const breakdown = await this.sessionManagerService.getTokenBreakdown(sessionId);
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
  async killSession(
    @Param('sessionId') sessionId: string,
    @Ctx() ctx: RequestContext,
  ): Promise<{ success: boolean; message: string }> {
    const adminId = ctx.apiKeyId || ctx.tenantId;
    const success = await this.sessionManagerService.killSession(sessionId, adminId);

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
  async bulkKillSessions(
    @Ctx() ctx: RequestContext,
    @Body('sessionIds') sessionIds: string[],
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
    // Validate request
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      throw new Error('sessionIds must be a non-empty array');
    }

    if (sessionIds.length > 100) {
      throw new Error('Cannot terminate more than 100 sessions at once');
    }

    const adminId = ctx.apiKeyId || ctx.tenantId;
    return this.sessionManagerService.bulkKillSessions(sessionIds, adminId);
  }
}
