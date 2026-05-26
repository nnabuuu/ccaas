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
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthAdminOrBuilder, Ctx } from '../../auth/decorators';
import { AdminSolutionAccessGuard } from '../guards/admin-solution-access.guard';
import { RequestContext } from '../../auth/types';
import { SessionManagerService } from '../services/session-manager.service';
import { isAdminScope } from '../guards/admin-solution-access.guard';
import {
  SessionQueryDto,
  SessionListItem,
  SessionDetail,
  SessionTimeline,
  TokenBreakdown,
  TurnSummary,
} from '../dto/admin.dto';
import type { WorkspaceTreeResponse } from '../../common/interfaces';
import { BulkKillDto } from '../dto/bulk-kill.dto';
import { TimelineQueryDto } from '../dto/timeline-query.dto';
import { PaginatedSessions } from '../services/session-manager.service';

@ApiTags('admin')
@Controller('api/v1/admin/sessions')
@AuthAdminOrBuilder()
@UseGuards(AdminSolutionAccessGuard)
export class AdminSessionsController {
  constructor(private readonly sessionManagerService: SessionManagerService) {}

  /**
   * GET /api/v1/admin/sessions
   *
   * List all sessions with filtering and pagination
   */
  @Get()
  async getSessions(
    @Query() query: SessionQueryDto,
    @Ctx() ctx: RequestContext,
  ): Promise<PaginatedSessions> {
    // Builder keys: force tenant isolation on list endpoints
    if (!isAdminScope(ctx)) {
      query.solutionId = ctx.solutionId;
    }
    return this.sessionManagerService.getSessions(query);
  }

  /**
   * GET /api/v1/admin/sessions/active
   *
   * Get currently active sessions (processing or with active AgentEngine)
   */
  @Get('active')
  async getActiveSessions(@Ctx() ctx: RequestContext): Promise<SessionListItem[]> {
    const all = await this.sessionManagerService.getActiveSessions();
    // Builder keys: filter to own tenant only
    if (!isAdminScope(ctx)) {
      return all.filter((s) => s.solutionId === ctx.solutionId);
    }
    return all;
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
      ctx.solutionId,
      ctx.apiKeyScopes,
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
      ctx.solutionId,
      ctx.apiKeyScopes,
      query.turnNumber,
    );
  }

  /**
   * GET /api/v1/admin/sessions/:sessionId/turns
   *
   * Get turn summaries for a session
   */
  @Get(':sessionId/turns')
  async getSessionTurns(
    @Param('sessionId') sessionId: string,
    @Ctx() ctx: RequestContext,
  ): Promise<TurnSummary[]> {
    return this.sessionManagerService.getSessionTurns(
      sessionId,
      ctx.solutionId,
      ctx.apiKeyScopes,
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
      ctx.solutionId,
      ctx.apiKeyScopes,
    );
    // Session exists but has no recorded token usage — return zeros rather than 404.
    // (404 is reserved for when the session itself doesn't exist.)
    return breakdown ?? {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    };
  }

  /**
   * GET /api/v1/admin/sessions/:sessionId/workspace
   *
   * Get workspace file tree for a session
   */
  @Get(':sessionId/workspace')
  async getWorkspaceTree(
    @Param('sessionId') sessionId: string,
    @Ctx() ctx: RequestContext,
  ): Promise<WorkspaceTreeResponse> {
    // Verify session belongs to caller's tenant before exposing workspace
    await this.sessionManagerService.getSessionDetail(sessionId, ctx.solutionId, ctx.apiKeyScopes);
    return this.sessionManagerService.getWorkspaceTree(sessionId);
  }

  /**
   * GET /api/v1/admin/sessions/:sessionId/workspace/file?path=<relative-path>
   *
   * Get file content from session workspace for inline viewing.
   * Returns JSON with content string (text files) or null (binary/large files).
   */
  @Get(':sessionId/workspace/file')
  async getWorkspaceFileContent(
    @Param('sessionId') sessionId: string,
    @Query('path') filePath: string,
    @Ctx() ctx: RequestContext,
  ): Promise<{ content: string | null; mimeType: string; size: number; filename: string; isBinary: boolean }> {
    if (!filePath) {
      throw new BadRequestException('path query parameter is required');
    }
    // Verify session belongs to caller's tenant before exposing file content
    await this.sessionManagerService.getSessionDetail(sessionId, ctx.solutionId, ctx.apiKeyScopes);
    return this.sessionManagerService.getWorkspaceFileContent(sessionId, filePath);
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
    const adminId = ctx.apiKeyId || ctx.solutionId;
    const success = await this.sessionManagerService.killSession(
      sessionId,
      adminId,
      ctx.solutionId,
      ctx.apiKeyScopes,
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
    @Ctx() _ctx: RequestContext,
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
    const adminId = ctx.apiKeyId || ctx.solutionId;
    return this.sessionManagerService.bulkKillSessions(
      dto.sessionIds,
      adminId,
      ctx.solutionId,
      ctx.apiKeyScopes,
    );
  }
}
