/**
 * Sessions Controller
 *
 * RESTful API for session management and message completion.
 * WebSocket is used only for server-to-client streaming events.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
  Logger,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiSecurity,
} from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import { SessionsGateway } from './sessions.gateway';
import { SessionService } from './session.service';
import { CompletionOrchestrationService } from './services/completion-orchestration.service';
import { SkillManagementService } from './services/skill-management.service';
import { AttachmentService } from './services/attachment.service';
import { SkillSyncService } from '../skills/skill-sync.service';
import { SkillsService } from '../skills/skills.service';
import { TenantsService } from '../tenants/tenants.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationContextService } from '../messages/conversation-context.service';
import { CreateCompletionDto, CancelCompletionDto } from './dto/create-completion.dto';
import type { FrontendEvent } from '../common/interfaces';

@ApiTags('sessions')
@Controller('api/v1/sessions')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(
    private readonly sessionsGateway: SessionsGateway,
    private readonly sessionService: SessionService,
    private readonly completionOrchestrationService: CompletionOrchestrationService,
    private readonly skillManagementService: SkillManagementService,
    private readonly attachmentService: AttachmentService,
    private readonly skillSyncService: SkillSyncService,
    private readonly skillsService: SkillsService,
    private readonly tenantsService: TenantsService,
    private readonly messagesService: MessagesService,
    private readonly conversationContextService: ConversationContextService,
  ) {}


  /**
   * Create completion (send message)
   * POST /api/v1/sessions/:sessionId/completion
   *
   * The response streams via WebSocket events to the connected client.
   */
  @Post(':sessionId/completion')
  @ApiOperation({
    summary: '发送消息 / Send Message',
    description: `
发送用户消息到指定会话，Agent 将通过 WebSocket 推送响应事件。

**WebSocket 事件流程：**
1. \`agent_status\` - Agent 开始处理
2. \`text_delta\` - 流式返回文本片段
3. \`tool_activity\` - 工具调用活动
4. \`agent_status\` - Agent 完成处理

**首次消息 vs 后续消息：**
- 首次消息会创建新的 AgentEngine 进程
- 后续消息使用 \`--resume\` 复用已有进程

**English:**
Send user message to the specified session. Agent will push response events via WebSocket.
    `,
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
    example: 'session-123',
  })
  @ApiBody({ type: CreateCompletionDto })
  @ApiResponse({
    status: 200,
    description: '消息已提交，将通过 WebSocket 推送响应 / Message submitted, responses will be pushed via WebSocket',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        sessionId: { type: 'string', example: 'session-123' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '请求参数错误或客户端未连接 / Bad request or client not connected',
  })
  async createCompletion(
    @Param('sessionId') sessionId: string,
    @Body() data: CreateCompletionDto,
  ) {
    let { clientId, message, tenantId, mcpServers, skillPath, enabledSkillSlugs, attachments } = data;

    this.logger.log(`Creating completion for session ${sessionId}`);
    this.logger.debug(`Request data: clientId=${clientId}, tenantId=${tenantId}`);

    // Find WebSocket connection
    const socket = this.sessionsGateway.getClientSocket(clientId);
    if (!socket) {
      throw new BadRequestException('Client not connected via WebSocket');
    }

    // Require tenantId for skill sync
    if (!tenantId) {
      this.logger.error('tenantId is required for chat');
      socket.emit('agent_status', {
        status: 'error',
        sessionId,
        error: 'tenantId is required.',
      });
      throw new BadRequestException('tenantId is required');
    }

    try {
      // REST-specific preprocessing: Auto-load tenant skills if not provided
      if (!enabledSkillSlugs || enabledSkillSlugs.length === 0) {
        this.logger.debug(`Auto-loading tenant skills for: ${tenantId}`);

        // Resolve tenant first
        const tenant = await this.tenantsService.findOne(tenantId);
        const resolvedTenantId = tenant?.id || tenantId;

        const allSkills = await this.skillsService.findPublished(resolvedTenantId);
        const enabledTenantSkills = allSkills.filter(skill => skill.enabled);

        enabledSkillSlugs = enabledTenantSkills.map(s => s.slug);

        this.logger.log(
          `Auto-loaded ${enabledSkillSlugs.length} enabled skills for tenant ${tenantId}`,
        );
      }

      // REST-specific preprocessing: Generate skill system prompt
      let systemPrompt: string | undefined;
      if (enabledSkillSlugs && enabledSkillSlugs.length > 0) {
        const tenant = await this.tenantsService.findOne(tenantId);
        const resolvedTenantId = tenant?.id || tenantId;

        systemPrompt = await this.skillManagementService.generateSystemPromptForSession(
          resolvedTenantId,
          enabledSkillSlugs,
        );
      }

      // REST-specific preprocessing: Resolve attachment paths
      const session = this.sessionService.getOrCreateSession(sessionId, clientId, socket);
      const resolvedAttachments = this.attachmentService.resolveAttachments(
        attachments,
        session.workspaceDir,
      );

      if (resolvedAttachments?.length) {
        this.logger.log(`Resolved ${resolvedAttachments.length} attachments`);
      }

      // Delegate to orchestration service
      await this.completionOrchestrationService.orchestrateMessage({
        session,
        clientId,
        tenantId,
        message,
        context: data.context,
        mcpServers,
        enabledSkillSlugs,
        skillPath,
        attachments: resolvedAttachments,
        systemPrompt,
        emitEvent: (event) => socket.emit(event.type, event),
      });

      return { success: true, sessionId };
    } catch (error) {
      this.logger.error(`Error creating completion: ${error}`);
      socket.emit('agent_status', {
        status: 'error',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }


  /**
   * Cancel completion
   * DELETE /api/v1/sessions/:sessionId/completion
   */
  @Delete(':sessionId/completion')
  @ApiOperation({
    summary: '取消当前操作 / Cancel Operation',
    description: '取消会话中正在进行的 Agent 操作 / Cancel the ongoing agent operation in the session',
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiBody({ type: CancelCompletionDto })
  @ApiResponse({
    status: 200,
    description: '操作已取消 / Operation cancelled',
  })
  cancelCompletion(
    @Param('sessionId') sessionId: string,
    @Body() data: CancelCompletionDto,
  ) {
    this.logger.log(`Cancelling completion for session ${sessionId}`);

    const socket = this.sessionsGateway.getClientSocket(data.clientId);
    if (!socket) {
      throw new BadRequestException('Client not connected');
    }

    const session = this.sessionService.getSession(sessionId);
    if (session) {
      this.sessionService.cancelSession(sessionId);
      socket.emit('agent_status', { status: 'cancelled', sessionId });
    }

    return { success: true };
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
}
