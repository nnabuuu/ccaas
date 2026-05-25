/**
 * Sessions Controller
 *
 * Unified RESTful API for session/conversation management, message completion,
 * and real-time streaming. "Session" and "Conversation" refer to the same
 * database entity — see ADR-0007 and docs/gitbook/en/guide/concepts.md.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  NotFoundException,
  Logger,
  Res,
  StreamableFile,
  Header,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream } from 'node:fs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionsGateway } from './sessions.gateway';
import { SessionService } from './session.service';
import { CompletionOrchestrationService } from './services/completion-orchestration.service';
import { MessageQueueService } from './services/message-queue.service';
import { SkillManagementService } from './services/skill-management.service';
import { AttachmentService } from './services/attachment.service';
import { CliProcessService } from './services/cli-process.service';
import { SkillSyncService } from '../skills/skill-sync.service';
import { SkillsService } from '../skills/skills.service';
import { TenantsService } from '../tenants/tenants.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationContextService } from '../messages/conversation-context.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ControlResponseDto } from './dto/control-response.dto';
import { StreamRegistryService } from './services/stream-registry.service';
import { makeSseClientId } from './session-utils';
import { v4 as uuidv4 } from 'uuid';
import { QuotaGuard } from '../admin/guards/quota.guard';
import { TenantGuard } from '../tenants/tenant.guard';
import { OptionalAuth, Auth, Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/types';
import { Session } from '../admin/entities/session.entity';
import { TurnsService } from '../admin/services/turns.service';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import {
  ListConversationsQuery,
  SearchConversationsQuery,
  UpdateConversationDto,
} from './dto/session-query.dto';

@ApiTags('sessions')
@Controller('api/v1/sessions')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(
    private readonly sessionsGateway: SessionsGateway,
    private readonly sessionService: SessionService,
    private readonly completionOrchestrationService: CompletionOrchestrationService,
    private readonly messageQueueService: MessageQueueService,
    private readonly skillManagementService: SkillManagementService,
    private readonly attachmentService: AttachmentService,
    private readonly cliProcessService: CliProcessService,
    private readonly skillSyncService: SkillSyncService,
    private readonly skillsService: SkillsService,
    private readonly tenantsService: TenantsService,
    private readonly messagesService: MessagesService,
    private readonly conversationContextService: ConversationContextService,
    private readonly streamRegistry: StreamRegistryService,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly turnsService: TurnsService,
  ) {}

  // ============================================================================
  // Session List / Search / Update / Delete (migrated from ConversationsController)
  // ============================================================================

  /**
   * List sessions with pagination
   * GET /api/v1/sessions
   */
  @Get()
  @UseGuards(TenantGuard)
  @OptionalAuth()
  @ApiOperation({
    summary: '列出会话 / List sessions',
    description: 'Retrieve a paginated list of sessions for the tenant.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isPinned', required: false, type: Boolean })
  @ApiQuery({ name: 'templateName', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Session list' })
  async listSessions(
    @Query() query: ListConversationsQuery,
    @CurrentTenant() tenantId: string | undefined,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const qb = this.sessionRepository.createQueryBuilder('session');

    // Tenant isolation — tenantId set by TenantGuard
    if (tenantId) {
      qb.andWhere('session.tenantId = :tenantId', { tenantId });
    }

    qb.andWhere('session.status != :closed', { closed: 'closed' });

    if (query.isPinned !== undefined) {
      qb.andWhere('session.isPinned = :isPinned', { isPinned: query.isPinned });
    }
    if (query.templateName) {
      qb.andWhere('session.templateName = :templateName', { templateName: query.templateName });
    }

    const total = await qb.getCount();
    const conversations = await qb
      .orderBy('session.lastActivity', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    const hasMore = offset + conversations.length < total;
    return { conversations, total, hasMore };
  }

  /**
   * Search sessions by title
   * GET /api/v1/sessions/search
   */
  @Get('search')
  @UseGuards(TenantGuard)
  @OptionalAuth()
  @ApiOperation({ summary: '搜索会话 / Search sessions by title' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchSessions(
    @Query() query: SearchConversationsQuery,
    @CurrentTenant() tenantId: string | undefined,
  ) {
    const qb = this.sessionRepository.createQueryBuilder('session');

    if (tenantId) {
      qb.andWhere('session.tenantId = :tenantId', { tenantId });
    }

    qb.andWhere('session.status != :closed', { closed: 'closed' });

    if (query.q) {
      qb.andWhere('session.title LIKE :query', { query: `%${query.q}%` });
    }
    if (query.dateFrom) {
      qb.andWhere('session.createdAt >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('session.createdAt <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb.orderBy('session.lastActivity', 'DESC').take(50).getMany();
  }

  /**
   * Update session metadata (title, isPinned)
   * PATCH /api/v1/sessions/:sessionId
   */
  @Patch(':sessionId')
  @UseGuards(TenantGuard)
  @Auth('chat')
  @ApiOperation({ summary: '更新会话 / Update session metadata' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Session updated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async updateSession(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateConversationDto,
    @Ctx() ctx: RequestContext,
  ) {
    const session = await this.sessionRepository.findOne({
      where: { sessionId, tenantId: ctx.tenantId },
    });
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    if (dto.title !== undefined) session.title = dto.title;
    if (dto.isPinned !== undefined) session.isPinned = dto.isPinned;

    return this.sessionRepository.save(session);
  }

  /**
   * Soft delete a session
   * DELETE /api/v1/sessions/:sessionId
   */
  @Delete(':sessionId')
  @UseGuards(TenantGuard)
  @Auth('chat')
  @ApiOperation({ summary: '删除会话 / Soft delete a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Session deleted' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @Ctx() ctx: RequestContext,
  ) {
    const session = await this.sessionRepository.findOne({
      where: { sessionId, tenantId: ctx.tenantId },
    });
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    session.closedAt = new Date();
    session.status = 'closed';
    await this.sessionRepository.save(session);
    return { success: true };
  }

  /**
   * Get turns for a session (analytics)
   * GET /api/v1/sessions/:sessionId/turns
   */
  @Get(':sessionId/turns')
  @UseGuards(TenantGuard)
  @OptionalAuth()
  @ApiOperation({ summary: '获取会话 Turn 列表 / Get session turns' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Turns list' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSessionTurns(
    @Param('sessionId') sessionId: string,
    @CurrentTenant() tenantId: string | undefined,
  ) {
    const where: Record<string, string> = { sessionId };
    if (tenantId) where.tenantId = tenantId;

    const session = await this.sessionRepository.findOne({ where });
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    return this.turnsService.getTurnsBySession(sessionId);
  }

  // ============================================================================
  // HTTP Streaming (SSE) - New Transport
  // ============================================================================

  /**
   * Send message with SSE streaming response
   * POST /api/v1/sessions/:sessionId/messages
   *
   * New HTTP streaming transport. No WebSocket required.
   * Response streams as text/event-stream until the turn completes.
   *
   * If the client disconnects and reconnects, pass ?afterSeq=N to replay
   * buffered events since sequence N.
   */
  @Post(':sessionId/messages')
  @OptionalAuth()
  @UseGuards(QuotaGuard)
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @ApiOperation({
    summary: '发送消息（SSE 流式响应）/ Send Message (SSE Streaming)',
    description: `
新的 HTTP 流式传输端点，无需 WebSocket 连接。
响应为 \`text/event-stream\`，Turn 结束时关闭连接。

**事件格式：**
每个 SSE 事件包含一个 JSON 对象，字段如下：
- \`seq\`: 递增序号（断线重连使用）
- \`sessionId\`: 会话 ID
- \`timestamp\`: ISO 时间戳
- \`event\`: 前端事件对象（与 WebSocket 事件格式一致）

**断线重连：**
在请求体中传 \`afterSeq\` 参数，服务端将重放该序号之后的所有缓存事件。

New HTTP streaming endpoint. No WebSocket required.
Response is \`text/event-stream\`, closed when Turn completes.
    `,
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 200, description: 'SSE 事件流 / SSE event stream' })
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() data: SendMessageDto,
    @Res() res: Response,
    @Ctx() ctx: RequestContext | undefined,
  ) {
    const subscriberId = uuidv4();
    this.logger.log(`SSE sendMessage: session=${sessionId} subscriber=${subscriberId}`);

    // Register this response as an SSE subscriber
    this.streamRegistry.subscribe(sessionId, subscriberId, res as any);

    // If client reconnecting, replay buffered events
    if (data.afterSeq !== undefined) {
      const missed = this.streamRegistry.getEventsSince(sessionId, data.afterSeq);
      this.logger.log(`Replaying ${missed.length} buffered events after seq=${data.afterSeq}`);
      for (const envelope of missed) {
        (res as any).write(`id: ${envelope.seq}\ndata: ${JSON.stringify(envelope)}\n\n`);
      }
    }

    let { enabledSkills } = data;

    // Auto-resolve tenantId from API key if not provided in body
    if (!data.tenantId) {
      data.tenantId = ctx?.tenantId;
    }

    if (!data.tenantId) {
      this.streamRegistry.emit(sessionId, {
        type: 'error',
        sessionId,
        timestamp: new Date().toISOString(),
        code: 'MISSING_TENANT_ID',
        message: 'tenantId is required',
        recoverable: false,
      });
      this.streamRegistry.closeSession(sessionId);
      return;
    }

    try {
      // Resolve tenant UUID once — reused for both skill loading and system
      // prompt generation, eliminating a redundant DB round-trip per request.
      const tenant = await this.tenantsService.findOne(data.tenantId);
      const resolvedTenantId = tenant?.id || data.tenantId;

      // Auto-load tenant skills if not provided AND no template will resolve them
      this.logger.debug(
        `sendMessage: templateName=${data.templateName ?? 'none'}, enabledSkills=${JSON.stringify(enabledSkills ?? null)}`,
      );
      if ((!enabledSkills || enabledSkills.length === 0) && !data.templateName) {
        const allSkills = await this.skillsService.findPublished(resolvedTenantId);
        enabledSkills = allSkills.filter(s => s.enabled).map(s => s.slug);
      }

      // Generate skill system prompt (resolved at enqueue time so the worker
      // inherits exactly what the caller intended even if skills change later)
      let systemPrompt: string | undefined;
      if (enabledSkills && enabledSkills.length > 0) {
        systemPrompt = await this.skillManagementService.generateSystemPromptForSession(
          resolvedTenantId,
          enabledSkills,
        );
      }

      if (data.appendSystemPrompt?.trim()) {
        systemPrompt = systemPrompt
          ? `${systemPrompt}\n\n${data.appendSystemPrompt}`
          : data.appendSystemPrompt;
      }

      // Enqueue — worker handles session creation, orchestration, and SSE teardown.
      // The SSE connection is kept alive because streamRegistry.subscribe() holds
      // the response open; the worker calls streamRegistry.closeTurn() for this subscriber.
      const clientId = makeSseClientId(sessionId);
      await this.messageQueueService.enqueue(
        sessionId,
        clientId,
        resolvedTenantId,
        {
          message: data.message,
          context: data.context,
          enabledSkills,
          systemPrompt,
          templateName: data.templateName,
          autoClose: data.autoClose,
          subscriberId,
          attachments: data.attachments?.map(a => ({ type: a.type, path: a.path })),
          userId: data.userId,
        },
      );
      // Return — SSE stays open until the worker calls streamRegistry.closeSession()
    } catch (error) {
      this.logger.error(`SSE sendMessage error: ${error}`);
      this.streamRegistry.emit(sessionId, {
        type: 'error',
        sessionId,
        timestamp: new Date().toISOString(),
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        recoverable: false,
      });
      this.streamRegistry.closeSession(sessionId);
    }
  }

  /**
   * Subscribe to push events (long-lived SSE)
   * GET /api/v1/sessions/:sessionId/events
   *
   * A persistent SSE stream that stays open across turns.
   * Delivers subagent_started / subagent_completed events from background
   * task monitors that fire after the per-turn POST /messages stream closes.
   *
   * The stream uses the key `${sessionId}:push` in StreamRegistryService —
   * separate from the per-turn `sessionId` key, so closeSession() on turn-end
   * does NOT close this connection.
   */
  @Get(':sessionId/events')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @ApiOperation({
    summary: '订阅推送事件 (SSE) / Subscribe to Push Events (SSE)',
    description: `
长连接 SSE 流，跨 Turn 保持打开。用于接收后台任务完成事件（如 subagent_completed）。

Long-lived SSE stream that stays open across turns.
Delivers background task lifecycle events (subagent_started, subagent_completed).
Does NOT close when a turn ends — use this instead of per-turn POST /messages stream for monitoring.
    `,
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiResponse({ status: 200, description: '持续 SSE 事件流 / Persistent SSE event stream' })
  async subscribeEvents(
    @Param('sessionId') sessionId: string,
    @Res() res: Response,
  ) {
    // Verify session exists before subscribing
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    // Limit subscribers per session to prevent resource exhaustion
    const MAX_SUBSCRIBERS_PER_SESSION = 10;
    const pushKey = `${sessionId}:push`;
    if (this.streamRegistry.getSubscriberCount(pushKey) >= MAX_SUBSCRIBERS_PER_SESSION) {
      throw new BadRequestException(`Too many subscribers for session ${sessionId}`);
    }

    const subscriberId = uuidv4();
    this.logger.log(`Push SSE subscribe: session=${sessionId} subscriber=${subscriberId}`);
    // Uses push channel key — NOT closed by turn-end (closeSession uses 'sessionId', not ':push')
    this.streamRegistry.subscribe(`${sessionId}:push`, subscriberId, res as any);
    // Client disconnect is handled automatically by StreamRegistryService res.on('close') handler
  }

  /**
   * Cancel current turn
   * POST /api/v1/sessions/:sessionId/cancel
   *
   * REST endpoint to cancel the current turn.
   * Works for both WebSocket and SSE transport.
   */
  @Post(':sessionId/cancel')
  @ApiOperation({
    summary: '取消当前 Turn / Cancel Current Turn',
    description: '取消正在进行的 Turn（兼容 WebSocket 和 SSE 传输）/ Cancel the ongoing turn (works for both WebSocket and SSE transport)',
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiResponse({ status: 200, description: '已发送取消信号 / Cancel signal sent' })
  cancelTurn(@Param('sessionId') sessionId: string) {
    this.logger.log(`Cancelling turn for session ${sessionId}`);

    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    this.sessionService.cancelSession(sessionId);

    // Notify SSE subscribers about cancellation
    this.streamRegistry.emit(sessionId, {
      type: 'agent_status',
      status: 'cancelled',
      sessionId,
      timestamp: new Date().toISOString(),
    });
    this.streamRegistry.closeSession(sessionId);

    return { success: true, sessionId };
  }

  /**
   * Submit control response (for AskUserQuestion wizard answers)
   * POST /api/v1/sessions/:sessionId/control-response
   *
   * Frontend calls this after the user completes a wizard / answers questions.
   * Backend writes the response to CLI stdin, resuming the paused LLM.
   */
  @Post(':sessionId/control-response')
  @UseGuards(TenantGuard)
  @OptionalAuth()
  @ApiOperation({
    summary: '提交控制响应 / Submit Control Response',
    description: `
前端在用户完成向导或回答问题后调用此端点。
Backend 将用户答案写入 CLI stdin，恢复被暂停的 LLM 执行。

Called by frontend after the user completes a wizard or answers questions.
Backend writes the answers to CLI stdin, resuming the paused LLM execution.
    `,
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiResponse({ status: 200, description: '响应已发送 / Response sent' })
  @ApiResponse({ status: 404, description: '会话不存在 / Session not found' })
  @ApiResponse({ status: 400, description: '请求无效 / Invalid request' })
  submitControlResponse(
    @Param('sessionId') sessionId: string,
    @Body() body: ControlResponseDto,
  ) {
    this.logger.log(`Control response: session=${sessionId} requestId=${body.requestId}`);

    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    this.cliProcessService.sendControlResponse(session, body.requestId, body.answers);

    return { success: true, sessionId, requestId: body.requestId };
  }

  /**
   * Get session status
   * GET /api/v1/sessions/:sessionId
   */
  @Get(':sessionId')
  @ApiOperation({
    summary: '获取会话状态 / Get Session Status',
    description: '获取会话的当前状态和统计信息 / Get current status and statistics of the session',
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiResponse({
    status: 200,
    description: '会话状态 / Session status',
    schema: {
      properties: {
        sessionId: { type: 'string' },
        status: { type: 'string', enum: ['idle', 'processing', 'error', 'closed', 'cancelling'] },
        messageCount: { type: 'number' },
        createdAt: { type: 'string', format: 'date-time' },
        lastActivity: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '会话不存在 / Session not found',
  })
  getSession(@Param('sessionId') sessionId: string) {
    const status = this.sessionService.getSessionStatus(sessionId);
    if (!status) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
    return status;
  }

  /**
   * Get active sub-agents for a session
   * GET /api/v1/sessions/:sessionId/sub-agents
   *
   * Returns list of currently running sub-agents.
   * Used by frontend for polling fallback when WebSocket is unreliable.
   */
  @Get(':sessionId/sub-agents')
  @ApiOperation({
    summary: '获取活跃子代理 / Get Active Sub-agents',
    description: '获取会话中正在运行的子代理列表 / Get list of currently running sub-agents in the session',
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiResponse({
    status: 200,
    description: '活跃子代理列表 / List of active sub-agents',
  })
  getActiveSubAgents(@Param('sessionId') sessionId: string) {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    // Get active sub-agents from SessionsGateway → EventMapper
    const activeSubAgents = this.sessionsGateway.getActiveSubAgents(sessionId);

    return {
      sessionId,
      activeSubAgents,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Restart session
   * POST /api/v1/sessions/:sessionId/restart
   */
  @Post(':sessionId/restart')
  @ApiOperation({
    summary: '重启会话 / Restart Session',
    description: '终止当前 Agent 进程并清理会话状态，下次消息将创建新进程 / Terminate current agent process and clean session state',
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiResponse({
    status: 200,
    description: '会话已重启 / Session restarted',
  })
  @ApiResponse({
    status: 404,
    description: '会话不存在 / Session not found',
  })
  restartSession(
    @Param('sessionId') sessionId: string,
    @Body() body?: { tenantId?: string },
  ) {
    const success = this.sessionService.restartSession(sessionId, body?.tenantId);
    if (!success) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
    return { success: true };
  }

  /**
   * Bind a session to a project so the agent-runtime sync layer knows
   * which artifacts to load/save. Fires `session.bound` → triggers
   * `SessionAssetSyncer.onSessionBound` which bootstraps the workspace
   * from `RestProjectArtifactSource.loadArtifacts(projectId)`.
   *
   * Idempotent: re-binding the same projectId is a no-op write + no-op
   * sync converge.
   *
   * POST /api/v1/sessions/:sessionId/bind-project
   * body: { projectId: string, tenantId: string }
   */
  @Post(':sessionId/bind-project')
  @OptionalAuth()
  @ApiOperation({
    summary: '绑定 session 到 project / Bind Session to Project',
    description:
      'Tells agent-runtime which project this session edits. Required ' +
      'before the agent can read/write project artifacts. Idempotent.',
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiResponse({ status: 200, description: '绑定成功 / Bound' })
  @ApiResponse({ status: 400, description: 'projectId / tenantId missing' })
  @ApiResponse({ status: 404, description: '会话不存在 / Session not found' })
  async bindToProject(
    @Param('sessionId') sessionId: string,
    @Body() body: { projectId?: string; tenantId?: string },
  ): Promise<{ success: true; sessionId: string; projectId: string }> {
    if (!body?.projectId) {
      throw new BadRequestException('projectId required in request body');
    }
    if (!body?.tenantId) {
      throw new BadRequestException('tenantId required in request body');
    }
    await this.sessionService.bindToProject(sessionId, body.tenantId, body.projectId);
    return { success: true, sessionId, projectId: body.projectId };
  }


  /**
   * List files in session workspace
   * GET /api/v1/sessions/:sessionId/workspace
   */
  @Get(':sessionId/workspace')
  @ApiOperation({
    summary: '列出工作区文件 / List Workspace Files',
    description: '获取会话工作区的文件树结构（实时文件系统快照）/ Get file tree structure of the session workspace',
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiResponse({
    status: 200,
    description: '工作区文件树 / Workspace file tree',
    schema: {
      properties: {
        tree: {
          type: 'array',
          items: {
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['file', 'directory'] },
              size: { type: 'number' },
              children: { type: 'array' },
            },
          },
        },
      },
    },
  })
  async listWorkspaceFiles(@Param('sessionId') sessionId: string) {
    this.logger.log(`[Workspace] List files for session ${sessionId}`);
    return this.sessionService.getWorkspaceTree(sessionId);
  }

  /**
   * Get file content from session workspace for inline viewing
   * GET /api/v1/sessions/:sessionId/workspace/file?path=<relative-path>
   */
  @Get(':sessionId/workspace/file')
  @ApiOperation({
    summary: '获取工作区文件内容（内联查看）/ Get Workspace File Content (Inline)',
    description: '以 JSON 格式返回文件内容，用于前端内联展示（非下载）/ Returns file content as JSON for inline display (not download)',
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiResponse({
    status: 200,
    description: '文件内容 / File content',
    schema: {
      properties: {
        content: { type: 'string', nullable: true },
        mimeType: { type: 'string' },
        size: { type: 'number' },
        filename: { type: 'string' },
        isBinary: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 404, description: '文件不存在 / File not found' })
  async getWorkspaceFileContent(
    @Param('sessionId') sessionId: string,
    @Query('path') filePath: string,
  ) {
    this.logger.log(`[Workspace] Get file content: ${sessionId}/${filePath}`);
    return this.sessionService.getWorkspaceFileContent(sessionId, filePath);
  }

  /**
   * Download file from session workspace
   * GET /api/v1/sessions/:sessionId/workspace/*
   */
  @Get(':sessionId/workspace/*')
  @ApiOperation({
    summary: '下载工作区文件 / Download Workspace File',
    description: '从会话工作区下载指定文件 / Download a specific file from the session workspace',
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiParam({
    name: '*',
    description: '文件路径（相对于工作区根目录）/ File path (relative to workspace root)',
    example: 'output.txt',
  })
  @ApiResponse({
    status: 200,
    description: '文件流 / File stream',
  })
  @ApiResponse({
    status: 404,
    description: '文件不存在 / File not found',
  })
  async downloadWorkspaceFile(
    @Param('sessionId') sessionId: string,
    @Param('*') filePath: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    this.logger.log(`[Workspace] Download file: ${sessionId}/${filePath}`);

    // Get file info with security validation
    const fileInfo = await this.sessionService.getWorkspaceFile(sessionId, filePath);

    // Set response headers
    res.set({
      'Content-Type': fileInfo.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`,
      'Content-Length': fileInfo.size.toString(),
    });

    // Stream the file
    const fileStream = createReadStream(fileInfo.absolutePath);
    return new StreamableFile(fileStream);
  }

  /**
   * Get queue status for a session
   * GET /api/v1/sessions/:sessionId/queue
   */
  @Get(':sessionId/queue')
  @ApiOperation({
    summary: '获取会话队列状态 / Get Session Queue Status',
    description: `
获取指定会话的消息队列状态，包括待处理、处理中、已完成的消息。

**使用场景：**
- 页面刷新后恢复队列状态
- 显示"您的消息排在第X位"
- 查看消息处理历史

**注意：** 只在 MESSAGE_QUEUE_ENABLED=true 时有数据。

Get message queue status for a session, including pending, processing, and completed messages.

**Use Cases:**
- Restore queue state after page refresh
- Show "Your message is #X in queue"
- View message processing history

**Note:** Only returns data when MESSAGE_QUEUE_ENABLED=true.
    `,
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiResponse({
    status: 200,
    description: '队列状态 / Queue status',
    schema: {
      example: {
        total: 3,
        pending: 2,
        processing: 1,
        items: [
          {
            id: 'queue-1',
            status: 'processing',
            message: 'Design a lesson plan...',
            priority: 0,
            retryCount: 0,
            createdAt: '2026-02-14T10:00:00Z',
            startedAt: '2026-02-14T10:00:05Z',
          },
          {
            id: 'queue-2',
            status: 'pending',
            message: 'Create a quiz...',
            priority: 0,
            retryCount: 0,
            createdAt: '2026-02-14T10:00:10Z',
          },
        ],
      },
    },
  })
  async getSessionQueue(@Param('sessionId') sessionId: string) {
    this.logger.log(`[Queue] Get queue status for session: ${sessionId}`);

    const [depth, items] = await Promise.all([
      this.messageQueueService.getSessionQueueDepth(sessionId),
      this.messageQueueService.getSessionQueue(sessionId, false), // Only active items
    ]);

    return {
      total: depth.total,
      pending: depth.pending,
      processing: depth.processing,
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        message: item.payload.message.substring(0, 200), // First 200 chars
        priority: item.priority,
        retryCount: item.retryCount,
        maxRetries: item.maxRetries,
        nextRetryAt: item.nextRetryAt,
        createdAt: item.createdAt,
        startedAt: item.startedAt,
        error: item.error,
      })),
    };
  }

  /**
   * Get single queue item details
   * GET /api/v1/queue/:queueItemId
   */
  @Get('/queue/:queueItemId')
  @ApiOperation({
    summary: '获取队列消息详情 / Get Queue Item Details',
    description: `
获取单个队列消息的详细信息，包括状态、重试次数、错误信息等。

**使用场景：**
- 检查消息是否完成
- 查看失败原因
- 监控重试进度

Get detailed information about a single queue item, including status, retry count, and error details.

**Use Cases:**
- Check if message is completed
- View failure reason
- Monitor retry progress
    `,
  })
  @ApiParam({
    name: 'queueItemId',
    description: '队列项 ID / Queue item ID',
  })
  @ApiResponse({
    status: 200,
    description: '队列项详情 / Queue item details',
    schema: {
      example: {
        id: 'queue-1',
        sessionId: 'session-1',
        status: 'completed',
        message: 'Design a lesson plan for grade 5 math',
        priority: 0,
        retryCount: 0,
        maxRetries: 2,
        createdAt: '2026-02-14T10:00:00Z',
        startedAt: '2026-02-14T10:00:05Z',
        completedAt: '2026-02-14T10:02:30Z',
        durationMs: 145000,
        userMessageId: 'msg-user-1',
        assistantMessageId: 'msg-assistant-1',
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '队列项不存在 / Queue item not found',
  })
  async getQueueItem(@Param('queueItemId') queueItemId: string) {
    this.logger.log(`[Queue] Get queue item: ${queueItemId}`);

    const item = await this.messageQueueService.getQueueItem(queueItemId);

    if (!item) {
      throw new NotFoundException(`Queue item ${queueItemId} not found`);
    }

    return {
      id: item.id,
      sessionId: item.sessionId,
      status: item.status,
      message: item.payload.message,
      priority: item.priority,
      retryCount: item.retryCount,
      maxRetries: item.maxRetries,
      nextRetryAt: item.nextRetryAt,
      createdAt: item.createdAt,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      durationMs: item.durationMs,
      userMessageId: item.userMessageId,
      assistantMessageId: item.assistantMessageId,
      error: item.error,
    };
  }

  @Get(':sessionId/queue-position')
  @ApiOperation({ summary: 'Session 排队位置 / Session queue position' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  async getQueuePosition(@Param('sessionId') sessionId: string) {
    return this.messageQueueService.getSessionQueuePosition(sessionId);
  }
}
