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
import { ChatGateway } from '../chat/chat.gateway';
import { SessionService } from '../chat/session.service';
import { SkillSyncService } from '../skills/skill-sync.service';
import { SkillsService } from '../skills/skills.service';
import { TenantsService } from '../tenants/tenants.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationContextService } from '../messages/conversation-context.service';
import { CreateCompletionDto, CancelCompletionDto } from './dto/create-completion.dto';
import { UpdateContextDto } from './dto/update-context.dto';
import type { FrontendEvent } from '../common/interfaces';

@ApiTags('sessions')
@Controller('api/v1/sessions')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly sessionService: SessionService,
    private readonly skillSyncService: SkillSyncService,
    private readonly skillsService: SkillsService,
    private readonly tenantsService: TenantsService,
    private readonly messagesService: MessagesService,
    private readonly conversationContextService: ConversationContextService,
  ) {}

  /**
   * Generate skill system prompt for --append-system-prompt CLI parameter
   *
   * Creates a critical instruction block that forces Claude to read SKILL.md
   * files before responding to skill-related requests.
   */
  private generateSkillSystemPrompt(
    skills: Array<{ slug: string; name: string; description?: string }>,
  ): string {
    if (skills.length === 0) return '';

    const skillList = skills
      .map((s) => `  - **${s.name}** (\`${s.slug}\`)${s.description ? `: ${s.description}` : ''}`)
      .join('\n');

    return `
CRITICAL SKILL USAGE INSTRUCTIONS:

This session has ${skills.length} specialized skill(s) available:
${skillList}

MANDATORY WORKFLOW - 强制工作流:

When a user message relates to ANY of the skills above:
1. IMMEDIATELY use Read tool: Read(".claude/skills/{relevant-skill-slug}/SKILL.md")
2. The SKILL.md contains MANDATORY instructions (e.g., "call read_context first")
3. Follow those instructions EXACTLY before responding

Why this matters:
- SKILL.md contains domain expertise you don't have
- SKILL.md provides tools to access existing data (read_context, read_form_state, etc.)
- Following SKILL.md prevents asking users for data they already provided

Example (lesson planning):
❌ WRONG: Ask "What's your subject? Grade level?"
✅ RIGHT: Read(".claude/skills/lesson-plan-designer/SKILL.md") → Follow instructions → Use read_context → Respond with data

Remember: Skills are your PRIMARY tools. Always read SKILL.md before responding to skill-related requests.
`.trim();
  }

  /**
   * Create CLAUDE.md with skill loading instructions
   *
   * This method creates a CLAUDE.md file in the workspace that instructs
   * Claude Code to load and use the synced skills.
   */
  private async createClaudeMd(
    workspaceDir: string,
    skills: Array<{ name: string; slug: string; description?: string }>,
  ): Promise<void> {
    const claudeMdPath = path.join(workspaceDir, 'CLAUDE.md');

    const content = `# Session Skills Configuration

This session has access to the following skills:

${skills.map(s => `- **${s.name}** (\`${s.slug}\`)${s.description ? `: ${s.description}` : ''}`).join('\n')}

These skills are available in the \`.claude/skills/\` directory.

## ⚠️ CRITICAL REQUIREMENT - 强制要求

**When you decide to use ANY skill (one or multiple), you MUST read its SKILL.md file BEFORE taking any action:**

\`\`\`
Read(".claude/skills/{skill-slug}/SKILL.md")
\`\`\`

### Why This is Mandatory

Each SKILL.md contains:
- **Mandatory workflow steps** (e.g., "call \`read_context\` first")
- **Available tools and data sources** (form context, user data, etc.)
- **Domain-specific instructions** (curriculum standards, formatting rules, etc.)
- **Required output format**

**These are NOT optional suggestions** - they are execution requirements.

### Key Principle: Don't Ask for Data That's Available

Skills often provide tools to access existing data (like \`read_context\`, \`read_form_state\`, etc.):

❌ **Wrong**: Ask user "What's your subject? Grade level?"
✅ **Right**: Read SKILL.md → see it requires \`read_context\` → call it → use the data

### Multiple Skills

If a task requires multiple skills working together:
- Read each skill's SKILL.md before using it
- Follow each skill's workflow requirements
- Coordinate between skills as needed

## Example

**Scenario**: User asks for help with lesson planning

**Correct workflow**:
1. Recognize lesson-plan-designer skill is relevant
2. \`Read(".claude/skills/lesson-plan-designer/SKILL.md")\`
3. SKILL.md says: "⚠️ Before responding, call \`read_context\`"
4. Call \`read_context\` → get { subject: "数学", gradeLevel: 7, ... }
5. Use this data directly in response

**Wrong workflow** ❌:
1. Skip reading SKILL.md
2. Ask "你的学科是什么？" → User already provided this in the form!

---

**Remember**: SKILL.md files are the source of truth for how to use each skill correctly.
`;

    await fs.promises.writeFile(claudeMdPath, content, 'utf-8');
    this.logger.log(`Created CLAUDE.md with ${skills.length} skills`);
  }

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

    // Debug logging for context field
    this.logger.debug(`=== CREATE COMPLETION DEBUG ===`);
    this.logger.debug(`Received keys: ${Object.keys(data).join(', ')}`);
    this.logger.debug(`Has context: ${!!data.context}`);
    if (data.context) {
      this.logger.debug(`Context keys: ${Object.keys(data.context).join(', ')}`);
      this.logger.debug(`Context preview: ${JSON.stringify(data.context).slice(0, 200)}`);
    }
    this.logger.debug(`==============================`);

    this.logger.log(`Creating completion for session ${sessionId}`);
    this.logger.debug(`Request data: clientId=${clientId}, tenantId=${tenantId}, mcpServers=${mcpServers ? JSON.stringify(Object.keys(mcpServers)) : 'none'}, skillPath=${skillPath || 'none'}, enabledSkillSlugs=${enabledSkillSlugs ? enabledSkillSlugs.join(', ') : 'none'}`);

    // Find WebSocket connection
    const socket = this.chatGateway.getClientSocket(clientId);
    if (!socket) {
      throw new BadRequestException('Client not connected via WebSocket');
    }

    // Require tenantId for skill sync
    if (!tenantId) {
      this.logger.error('tenantId is required for chat - skills cannot be loaded without a tenant');
      socket.emit('agent_status', {
        status: 'error',
        sessionId,
        error: 'tenantId is required. Skills cannot be loaded without a tenant.',
      });
      throw new BadRequestException('tenantId is required');
    }

    try {
      // Phase 2: Auto-load tenant skills if not provided
      if (!enabledSkillSlugs || enabledSkillSlugs.length === 0) {
        this.logger.debug(`No enabledSkillSlugs provided, querying tenant skills for: ${tenantId}`);

        // Resolve tenant slug/id to actual tenant UUID first
        let queryTenantId = tenantId;
        try {
          const tenant = await this.tenantsService.findOne(tenantId);
          if (tenant) {
            queryTenantId = tenant.id;
          }
        } catch (error) {
          this.logger.warn(`Failed to resolve tenant for skill query: ${error}`);
        }

        const allSkills = await this.skillsService.findPublished(queryTenantId);
        const enabledTenantSkills = allSkills.filter(skill => skill.enabled);

        enabledSkillSlugs = enabledTenantSkills.map(s => s.slug);

        this.logger.log(
          `Auto-loaded ${enabledSkillSlugs.length} enabled skills for tenant ${tenantId}: ${enabledSkillSlugs.join(', ')}`,
        );
      }
      // Resolve tenant slug/id to actual tenant UUID
      let resolvedTenantId = tenantId;
      try {
        const tenant = await this.tenantsService.findOne(tenantId);
        if (tenant) {
          resolvedTenantId = tenant.id;
          this.logger.debug(`Resolved tenant ${tenantId} to UUID ${resolvedTenantId}`);
        } else {
          this.logger.warn(`Tenant not found: ${tenantId}, using as-is`);
        }
      } catch (error) {
        this.logger.warn(`Failed to resolve tenant: ${error}`);
      }

      // Get or create session
      const session = this.sessionService.getOrCreateSession(sessionId, clientId, socket);

      // Store tenant context
      session.tenantId = resolvedTenantId;

      // Store MCP servers configuration
      if (mcpServers && Object.keys(mcpServers).length > 0) {
        session.mcpServers = mcpServers;
        this.logger.log(`Session ${sessionId} configured with MCP servers: ${Object.keys(mcpServers).join(', ')}`);
      }

      // Sync tenant skills to session workspace
      try {
        const syncResult = await this.skillSyncService.syncToSession(
          session.workspaceDir,
          resolvedTenantId,
          {
            publishedOnly: true,
            skillSlugs: enabledSkillSlugs,
          },
        );
        session.skillSyncedAt = new Date();
        this.logger.log(`Synced ${syncResult.skillCount} skills for tenant ${tenantId} (${resolvedTenantId})`);

        // Phase 1: Create CLAUDE.md after syncing skills
        if (enabledSkillSlugs && enabledSkillSlugs.length > 0) {
          const allSkills = await this.skillsService.findPublished(resolvedTenantId);
          const skillSlugs = enabledSkillSlugs; // Type narrowing
          const skillsToDocument = allSkills.filter(skill =>
            skillSlugs.includes(skill.slug)
          );

          if (skillsToDocument.length > 0) {
            // Create CLAUDE.md for workspace context
            await this.createClaudeMd(
              session.workspaceDir,
              skillsToDocument.map(s => ({
                name: s.name,
                slug: s.slug,
                description: s.description,
              })),
            );

            // Generate skill system prompt for CLI --append-system-prompt
            const skillPrompt = this.generateSkillSystemPrompt(
              skillsToDocument.map(s => ({
                slug: s.slug,
                name: s.name,
                description: s.description || '',
              })),
            );

            // Store in session for subsequent resume calls
            session.appendSystemPrompt = skillPrompt;

            this.logger.log(`Generated skill system prompt for ${skillsToDocument.length} skills`);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to sync skills: ${error}`);
      }

      // If solution provided a skill file path, copy it to session workspace
      this.logger.debug(`Checking skillPath: ${skillPath}, exists: ${skillPath ? fs.existsSync(skillPath) : false}`);
      if (skillPath && fs.existsSync(skillPath)) {
        try {
          const skillName = path.basename(path.dirname(skillPath));
          const targetDir = path.join(session.workspaceDir, '.claude', 'skills', skillName);
          fs.mkdirSync(targetDir, { recursive: true });
          fs.copyFileSync(skillPath, path.join(targetDir, 'SKILL.md'));
          this.logger.log(`Copied skill ${skillName} to session workspace from ${skillPath}`);

          // Create CLAUDE.md to instruct Claude to read the skill guide
          const claudeMdPath = path.join(session.workspaceDir, 'CLAUDE.md');
          const claudeMdContent = `# Session Workspace

## 强制执行步骤

**在回复用户的任何消息之前，你必须先阅读技能指南：**

使用 Read 工具读取技能的完整指南：
\`\`\`
Read(".claude/skills/${skillName}/SKILL.md")
\`\`\`

严格按照技能指南中的流程和工具说明来处理用户请求。

## 响应语言

使用与用户相同的语言回复。
`;
          fs.writeFileSync(claudeMdPath, claudeMdContent, 'utf-8');
          this.logger.log(`Created CLAUDE.md for session ${sessionId}`);
        } catch (error) {
          this.logger.warn(`Failed to copy skill file: ${error}`);
        }
      }

      // Create message records for persistence
      const userMessage = await this.messagesService.create({
        sessionId,
        tenantId: resolvedTenantId,
        role: 'user',
        content: message,
      });

      const assistantMessage = await this.messagesService.create({
        sessionId,
        tenantId: resolvedTenantId,
        role: 'assistant',
        content: '', // Will be accumulated as response streams in
      });

      // Store message IDs on session for file association
      session.currentUserMessageId = userMessage.id;
      session.currentAssistantMessageId = assistantMessage.id;

      this.logger.debug(
        `Created messages: user=${userMessage.id}, assistant=${assistantMessage.id}`,
      );

      // Store page context if provided (NEW: Write to workspace for MCP tool to read)
      if (data.context) {
        try {
          const contextDir = path.join(session.workspaceDir, '.context');
          const contextPath = path.join(contextDir, 'page-context.json');

          // Ensure directory exists
          if (!fs.existsSync(contextDir)) {
            fs.mkdirSync(contextDir, { recursive: true });
          }

          // Write context to file (with timestamp)
          const contextData = {
            ...data.context,
            timestamp: new Date().toISOString(),
          };
          fs.writeFileSync(contextPath, JSON.stringify(contextData, null, 2));

          this.logger.debug(`Wrote page context for session ${sessionId}: ${JSON.stringify(data.context).slice(0, 100)}...`);
        } catch (err) {
          this.logger.warn(`Failed to write page context: ${err}`);
        }
      }

      // Create or update ConversationContext (on first message)
      if (session.messageCount === 0) {
        try {
          await this.conversationContextService.createOrUpdate({
            sessionId,
            tenantId: resolvedTenantId,
            workspaceDir: session.workspaceDir,
            clientId,
          });
          this.logger.debug(`Created conversation context for session ${sessionId}`);
        } catch (err) {
          this.logger.warn(`Failed to create conversation context: ${err}`);
        }
      }

      // Notify frontend that agent is starting
      socket.emit('agent_status', {
        status: 'running',
        sessionId,
      });

      // Track accumulated text for message update
      let accumulatedText = '';

      // Event handler that also accumulates text
      const handleEvent = (event: FrontendEvent) => {
        // Accumulate text_delta events
        if (event.type === 'text_delta' && (event as any).text) {
          accumulatedText += (event as any).text;
        }

        // Emit to client
        socket.emit(event.type, event);

        // On completion, update the assistant message with accumulated content
        if (event.type === 'agent_status' && (event as any).status === 'complete') {
          this.messagesService
            .updateContent(assistantMessage.id, accumulatedText)
            .catch((err) => this.logger.error(`Failed to update message content: ${err}`));
        }
      };

      // Resolve attachment paths to absolute paths
      const resolvedAttachments = attachments?.map(a => ({
        type: a.type,
        absolutePath: path.join(session.workspaceDir, a.path),
        mimeType: this.guessMimeType(a.path),
      }));

      if (resolvedAttachments?.length) {
        this.logger.log(`Resolved ${resolvedAttachments.length} attachments for session ${sessionId}`);
      }

      // Check if this is a follow-up message
      if (session.messageCount > 0) {
        // Follow-up message - use --resume (appendSystemPrompt preserved in session)
        await this.sessionService.sendFollowUp(session, message, handleEvent, resolvedAttachments);
      } else {
        // First message - spawn new AgentEngine with appendSystemPrompt
        await this.sessionService.ensureCLIProcess(
          session,
          message,
          handleEvent,
          resolvedAttachments,
          session.appendSystemPrompt,
        );
      }

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

  private guessMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return map[ext] || 'application/octet-stream';
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

    const socket = this.chatGateway.getClientSocket(data.clientId);
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

    // Get active sub-agents from ChatGateway → EventMapper
    const activeSubAgents = this.chatGateway.getActiveSubAgents(sessionId);

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
   * Update session context
   * PUT /api/v1/sessions/:sessionId/context
   *
   * Syncs frontend form state to a file in the session workspace
   * so Claude Code can read current form values.
   */
  @Put(':sessionId/context')
  @ApiOperation({
    summary: '更新会话上下文 / Update Session Context',
    description: '同步前端表单状态到会话工作区，让 Agent 能够读取当前表单值 / Sync frontend form state to session workspace for agent access',
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiBody({ type: UpdateContextDto })
  @ApiResponse({
    status: 200,
    description: '上下文已更新 / Context updated',
  })
  async updateContext(
    @Param('sessionId') sessionId: string,
    @Body() data: UpdateContextDto,
  ) {
    await this.sessionService.updateContext(sessionId, data);
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
