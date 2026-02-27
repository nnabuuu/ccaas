import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { OptionalAuth } from '../auth/decorators';
import { MessagesService } from './messages.service';
import { ToolEventsService } from './tool-events.service';
import { ConversationContextService } from './conversation-context.service';
import { ProcessLifecycleService } from './process-lifecycle.service';
import { ApiErrorService } from './api-error.service';
import { ThinkingBlocksService } from './thinking-blocks.service';
import { TokenUsageService } from './token-usage.service';
import { UserContextService } from './user-context.service';
import { FilesService } from '../files/files.service';
import { MessageQueryDto, MessageResponseDto, ToolEventResponseDto } from './dto/message.dto';
import { Message } from './entities/message.entity';
import { ToolEvent } from './entities/tool-event.entity';

@ApiTags('messages')
@Controller('api/v1')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly toolEventsService: ToolEventsService,
    private readonly conversationContextService: ConversationContextService,
    private readonly processLifecycleService: ProcessLifecycleService,
    private readonly apiErrorService: ApiErrorService,
    private readonly thinkingBlocksService: ThinkingBlocksService,
    private readonly tokenUsageService: TokenUsageService,
    private readonly userContextService: UserContextService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Get all messages for a session
   * GET /api/v1/sessions/:sessionId/messages
   */
  @Get('sessions/:sessionId/messages')
  @OptionalAuth()
  @ApiOperation({
    summary: '获取会话消息 / Get Session Messages',
    description: '获取指定会话的所有消息（支持分页和工具事件过滤）/ Get all messages for a session with pagination',
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '返回条数限制 / Number of messages to return',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: '跳过条数 / Number of messages to skip',
    example: 0,
  })
  @ApiQuery({
    name: 'includeToolEvents',
    required: false,
    description: '是否包含工具调用事件 / Whether to include tool events',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: '消息列表 / Message list',
  })
  async getSessionMessages(
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includeToolEvents') includeToolEvents?: string,
  ): Promise<{ messages: MessageResponseDto[] }> {
    const messages = await this.messagesService.findBySessionId(sessionId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      includeToolEvents: includeToolEvents === 'true',
    });

    return {
      messages: messages.map((m) => this.toResponseDto(m)),
    };
  }

  /**
   * Get all files for a session
   * GET /api/v1/sessions/:sessionId/files
   */
  @Get('sessions/:sessionId/files')
  @OptionalAuth()
  @ApiOperation({
    summary: '获取会话文件 / Get Session Files',
    description: '获取会话中所有文件资源（包含 Agent 生成和用户上传的文件）/ Get all file resources in the session',
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiResponse({
    status: 200,
    description: '文件列表 / File list',
  })
  async getSessionFiles(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    files: Array<{
      id: string;
      filename: string;
      mimeType: string | null;
      size: number;
      messageId: string | null;
      createdAt: Date;
      downloadUrl: string;
    }>;
  }> {
    const files = await this.filesService.findBySessionId(sessionId);
    return {
      files: files.map((file) => ({
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        messageId: file.messageId,
        createdAt: file.createdAt,
        downloadUrl: `/api/v1/files/${file.id}/download`,
      })),
    };
  }

  /**
   * Get a single message by ID
   * GET /api/v1/messages/:messageId
   */
  @Get('messages/:messageId')
  @OptionalAuth()
  @ApiOperation({
    summary: '获取单条消息 / Get Single Message',
    description: '根据消息 ID 获取消息详情 / Get message details by ID',
  })
  @ApiParam({
    name: 'messageId',
    description: '消息 ID / Message ID',
  })
  @ApiResponse({
    status: 200,
    description: '消息详情 / Message details',
  })
  @ApiResponse({
    status: 404,
    description: '消息不存在 / Message not found',
  })
  async getMessage(
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<MessageResponseDto> {
    const message = await this.messagesService.findById(messageId);
    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }
    return this.toResponseDto(message);
  }

  /**
   * Get files for a message
   * GET /api/v1/messages/:messageId/files
   */
  @Get('messages/:messageId/files')
  @OptionalAuth()
  async getMessageFiles(
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<{
    files: Array<{
      id: string;
      filename: string;
      mimeType: string | null;
      size: number;
      downloadUrl: string;
    }>;
  }> {
    const message = await this.messagesService.findById(messageId);
    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    return {
      files: (message.files || []).map((f) => ({
        id: f.id,
        filename: f.filename,
        mimeType: f.mimeType,
        size: f.size,
        downloadUrl: `/api/v1/files/${f.id}/download`,
      })),
    };
  }

  /**
   * Query messages with filters
   * GET /api/v1/messages
   */
  @Get('messages')
  @OptionalAuth()
  async queryMessages(
    @Query() query: MessageQueryDto,
  ): Promise<{ messages: MessageResponseDto[] }> {
    const messages = await this.messagesService.query(query);
    return {
      messages: messages.map((m) => this.toResponseDto(m)),
    };
  }

  /**
   * Get tool events for a message
   * GET /api/v1/messages/:messageId/tool-events
   */
  @Get('messages/:messageId/tool-events')
  @OptionalAuth()
  async getMessageToolEvents(
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<{ toolEvents: ToolEventResponseDto[] }> {
    const message = await this.messagesService.findById(messageId);
    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    const toolEvents = await this.toolEventsService.findByMessageId(messageId);
    return {
      toolEvents: toolEvents.map((te) => this.toToolEventResponseDto(te)),
    };
  }

  /**
   * Get tool event statistics for a session
   * GET /api/v1/sessions/:sessionId/tool-stats
   */
  @Get('sessions/:sessionId/tool-stats')
  @OptionalAuth()
  async getSessionToolStats(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    totalEvents: number;
    toolCounts: Record<string, number>;
    successCount: number;
    errorCount: number;
    avgDurationMs: number;
  }> {
    return this.toolEventsService.getSessionStats(sessionId);
  }

  // =========================================================================
  // Extended Data Capture Endpoints
  // =========================================================================

  /**
   * Get conversation context for a session
   * GET /api/v1/sessions/:sessionId/context
   */
  @Get('sessions/:sessionId/context')
  @OptionalAuth()
  async getSessionContext(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    context: {
      id: string;
      sessionId: string;
      tenantId: string | null;
      systemPromptHash: string | null;
      skillConfigHashes: Array<{ slug: string; hash: string }> | null;
      mcpToolsList: string[] | null;
      model: string | null;
      workspaceDir: string | null;
      clientId: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
    } | null;
  }> {
    const context = await this.conversationContextService.getBySessionId(sessionId);
    return { context };
  }

  /**
   * Get process lifecycle events for a session
   * GET /api/v1/sessions/:sessionId/process-events
   */
  @Get('sessions/:sessionId/process-events')
  @OptionalAuth()
  async getProcessEvents(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    events: Array<{
      id: string;
      sessionId: string;
      eventType: string;
      pid: number | null;
      exitCode: number | null;
      signal: string | null;
      stderr: string | null;
      errorMessage: string | null;
      command: string | null;
      workingDir: string | null;
      createdAt: Date;
    }>;
    stats: {
      totalSpawns: number;
      totalExits: number;
      totalCrashes: number;
      totalKills: number;
    };
  }> {
    const events = await this.processLifecycleService.getBySessionId(sessionId);
    const stats = await this.processLifecycleService.getSessionStats(sessionId);
    return {
      events: events.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        eventType: e.eventType,
        pid: e.pid,
        exitCode: e.exitCode,
        signal: e.signal,
        stderr: e.stderr,
        errorMessage: e.errorMessage,
        command: e.command,
        workingDir: e.workingDir,
        createdAt: e.createdAt,
      })),
      stats: {
        totalSpawns: stats.totalSpawns,
        totalExits: stats.totalExits,
        totalCrashes: stats.totalCrashes,
        totalKills: stats.totalKills,
      },
    };
  }

  /**
   * Get API errors for a session
   * GET /api/v1/sessions/:sessionId/api-errors
   */
  @Get('sessions/:sessionId/api-errors')
  @OptionalAuth()
  async getApiErrors(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    errors: Array<{
      id: string;
      sessionId: string;
      messageId: string | null;
      errorType: string;
      statusCode: number | null;
      errorMessage: string | null;
      errorCode: string | null;
      retryAfterSeconds: number | null;
      wasRetried: boolean;
      retryAttempt: number | null;
      createdAt: Date;
    }>;
    stats: {
      totalErrors: number;
      byType: Record<string, number>;
      rateLimitCount: number;
      avgRetryAfter: number | null;
    };
  }> {
    const errors = await this.apiErrorService.getBySessionId(sessionId);
    const stats = await this.apiErrorService.getSessionStats(sessionId);
    return {
      errors: errors.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        messageId: e.messageId,
        errorType: e.errorType,
        statusCode: e.statusCode,
        errorMessage: e.errorMessage,
        errorCode: e.errorCode,
        retryAfterSeconds: e.retryAfterSeconds,
        wasRetried: e.wasRetried,
        retryAttempt: e.retryAttempt,
        createdAt: e.createdAt,
      })),
      stats,
    };
  }

  /**
   * Get thinking blocks for a message
   * GET /api/v1/messages/:messageId/thinking
   */
  @Get('messages/:messageId/thinking')
  @OptionalAuth()
  async getMessageThinking(
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<{
    thinkingBlocks: Array<{
      id: string;
      thinkingId: string;
      content: string;
      sequenceNumber: number;
      status: string;
      interruptionReason: string | null;
      durationMs: number | null;
      thinkingTokens: number | null;
      startedAt: Date | null;
      createdAt: Date;
    }>;
  }> {
    const blocks = await this.thinkingBlocksService.getByMessageId(messageId);
    return {
      thinkingBlocks: blocks.map((b) => ({
        id: b.id,
        thinkingId: b.thinkingId,
        content: b.content,
        sequenceNumber: b.sequenceNumber,
        status: b.status,
        interruptionReason: b.interruptionReason,
        durationMs: b.durationMs,
        thinkingTokens: b.thinkingTokens,
        startedAt: b.startedAt,
        createdAt: b.createdAt,
      })),
    };
  }

  /**
   * Get thinking blocks for a session
   * GET /api/v1/sessions/:sessionId/thinking
   */
  @Get('sessions/:sessionId/thinking')
  @OptionalAuth()
  async getSessionThinking(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    thinkingBlocks: Array<{
      id: string;
      messageId: string;
      thinkingId: string;
      content: string;
      sequenceNumber: number;
      status: string;
      durationMs: number | null;
      thinkingTokens: number | null;
      createdAt: Date;
    }>;
    stats: {
      totalBlocks: number;
      completedBlocks: number;
      interruptedBlocks: number;
      totalDurationMs: number;
      totalThinkingTokens: number;
      avgDurationMs: number;
    };
  }> {
    const blocks = await this.thinkingBlocksService.getBySessionId(sessionId);
    const stats = await this.thinkingBlocksService.getSessionStats(sessionId);
    return {
      thinkingBlocks: blocks.map((b) => ({
        id: b.id,
        messageId: b.messageId,
        thinkingId: b.thinkingId,
        content: b.content,
        sequenceNumber: b.sequenceNumber,
        status: b.status,
        durationMs: b.durationMs,
        thinkingTokens: b.thinkingTokens,
        createdAt: b.createdAt,
      })),
      stats,
    };
  }

  /**
   * Get token usage for a session
   * GET /api/v1/sessions/:sessionId/token-usage
   */
  @Get('sessions/:sessionId/token-usage')
  @OptionalAuth()
  async getSessionTokenUsage(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    events: Array<{
      id: string;
      messageId: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      cachedInputTokens: number;
      reasoningTokens: number;
      estimatedCostUsd: number | null;
      stopReason: string | null;
      createdAt: Date;
    }>;
    summary: {
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCachedTokens: number;
      totalReasoningTokens: number;
      totalCostUsd: number;
      requestCount: number;
      cacheHitRate: number;
      modelBreakdown: Record<string, {
        requests: number;
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
      }>;
      averageContextUsage: number | null;
    };
  }> {
    const events = await this.tokenUsageService.getBySessionId(sessionId);
    const summary = await this.tokenUsageService.getSessionSummary(sessionId);
    return {
      events: events.map((e) => ({
        id: e.id,
        messageId: e.messageId,
        model: e.model,
        inputTokens: e.inputTokens,
        outputTokens: e.outputTokens,
        cachedInputTokens: e.cachedInputTokens,
        reasoningTokens: e.reasoningTokens,
        estimatedCostUsd: e.estimatedCostUsd,
        stopReason: e.stopReason,
        createdAt: e.createdAt,
      })),
      summary,
    };
  }

  /**
   * Get user context events for a session
   * GET /api/v1/sessions/:sessionId/user-context
   */
  @Get('sessions/:sessionId/user-context')
  @OptionalAuth()
  async getSessionUserContext(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    events: Array<{
      id: string;
      sessionId: string;
      messageId: string | null;
      pageUrl: string | null;
      pageTitle: string | null;
      selectedTextHash: string | null;
      selectedTextLength: number | null;
      viewport: { width: number; height: number } | null;
      darkMode: boolean | null;
      createdAt: Date;
    }>;
    stats: {
      totalContextEvents: number;
      uniqueUrls: number;
      avgSelectedTextLength: number | null;
      darkModeUsage: { dark: number; light: number; unknown: number };
    };
  }> {
    const events = await this.userContextService.getBySessionId(sessionId);
    const stats = await this.userContextService.getSessionStats(sessionId);
    return {
      events: events.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        messageId: e.messageId,
        pageUrl: e.pageUrl,
        pageTitle: e.pageTitle,
        selectedTextHash: e.selectedTextHash,
        selectedTextLength: e.selectedTextLength,
        viewport: e.viewport,
        darkMode: e.darkMode,
        createdAt: e.createdAt,
      })),
      stats,
    };
  }

  /**
   * Get full conversation trace (all data for reconstruction)
   * GET /api/v1/sessions/:sessionId/full-trace
   */
  @Get('sessions/:sessionId/full-trace')
  @OptionalAuth()
  @ApiOperation({
    summary: '获取完整会话跟踪 / Get Full Conversation Trace',
    description: `
获取会话的完整数据，用于重建对话或深度分析。

**包含数据：**
- 所有消息和工具事件
- Token 使用统计和成本分析
- 思考块（Thinking Blocks）
- 进程生命周期事件
- API 错误记录
- 用户上下文事件

**适用场景：**
- 会话导出和备份
- 数据分析和可视化
- 问题诊断和调试
- 成本核算

**English:**
Get complete session data for conversation reconstruction or deep analysis.
    `,
  })
  @ApiParam({
    name: 'sessionId',
    description: '会话 ID / Session ID',
  })
  @ApiResponse({
    status: 200,
    description: '完整会话跟踪数据 / Full trace data',
  })
  async getFullTrace(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    context: Awaited<ReturnType<typeof this.getSessionContext>>['context'];
    messages: MessageResponseDto[];
    thinkingBlocks: Awaited<ReturnType<typeof this.getSessionThinking>>['thinkingBlocks'];
    tokenUsage: Awaited<ReturnType<typeof this.getSessionTokenUsage>>['summary'];
    processEvents: Awaited<ReturnType<typeof this.getProcessEvents>>['events'];
    apiErrors: Awaited<ReturnType<typeof this.getApiErrors>>['errors'];
    userContext: Awaited<ReturnType<typeof this.getSessionUserContext>>['events'];
    toolStats: Awaited<ReturnType<typeof this.getSessionToolStats>>;
  }> {
    // Fetch all data in parallel for performance
    const [
      context,
      messages,
      thinkingResult,
      tokenUsageResult,
      processEventsResult,
      apiErrorsResult,
      userContextResult,
      toolStats,
    ] = await Promise.all([
      this.conversationContextService.getBySessionId(sessionId),
      this.messagesService.findBySessionId(sessionId, { includeToolEvents: true }),
      this.thinkingBlocksService.getBySessionId(sessionId),
      this.tokenUsageService.getSessionSummary(sessionId),
      this.processLifecycleService.getBySessionId(sessionId),
      this.apiErrorService.getBySessionId(sessionId),
      this.userContextService.getBySessionId(sessionId),
      this.toolEventsService.getSessionStats(sessionId),
    ]);

    return {
      context,
      messages: messages.map((m) => this.toResponseDto(m)),
      thinkingBlocks: thinkingResult.map((b) => ({
        id: b.id,
        messageId: b.messageId,
        thinkingId: b.thinkingId,
        content: b.content,
        sequenceNumber: b.sequenceNumber,
        status: b.status,
        durationMs: b.durationMs,
        thinkingTokens: b.thinkingTokens,
        createdAt: b.createdAt,
      })),
      tokenUsage: tokenUsageResult,
      processEvents: processEventsResult.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        eventType: e.eventType,
        pid: e.pid,
        exitCode: e.exitCode,
        signal: e.signal,
        stderr: e.stderr,
        errorMessage: e.errorMessage,
        command: e.command,
        workingDir: e.workingDir,
        createdAt: e.createdAt,
      })),
      apiErrors: apiErrorsResult.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        messageId: e.messageId,
        errorType: e.errorType,
        statusCode: e.statusCode,
        errorMessage: e.errorMessage,
        errorCode: e.errorCode,
        retryAfterSeconds: e.retryAfterSeconds,
        wasRetried: e.wasRetried,
        retryAttempt: e.retryAttempt,
        createdAt: e.createdAt,
      })),
      userContext: userContextResult.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        messageId: e.messageId,
        pageUrl: e.pageUrl,
        pageTitle: e.pageTitle,
        selectedTextHash: e.selectedTextHash,
        selectedTextLength: e.selectedTextLength,
        viewport: e.viewport,
        darkMode: e.darkMode,
        createdAt: e.createdAt,
      })),
      toolStats,
    };
  }

  /**
   * Transform Message entity to response DTO
   */
  private toResponseDto(message: Message): MessageResponseDto {
    return {
      id: message.id,
      sessionId: message.sessionId,
      tenantId: message.tenantId,
      role: message.role,
      content: message.content,
      metadata: message.metadata,
      messageIndex: message.messageIndex,
      createdAt: message.createdAt,
      files: (message.files || []).map((f) => ({
        id: f.id,
        filename: f.filename,
        mimeType: f.mimeType,
        size: f.size,
        downloadUrl: `/api/v1/files/${f.id}/download`,
      })),
      toolEvents: (message.toolEvents || []).map((te) => this.toToolEventResponseDto(te)),
    };
  }

  /**
   * Transform ToolEvent entity to response DTO
   */
  private toToolEventResponseDto(toolEvent: ToolEvent): ToolEventResponseDto {
    return {
      id: toolEvent.id,
      toolUseId: toolEvent.toolUseId,
      toolName: toolEvent.toolName,
      phase: toolEvent.phase,
      toolInput: toolEvent.toolInput,
      toolOutput: toolEvent.toolOutput,
      success: toolEvent.success,
      durationMs: toolEvent.durationMs,
      agentType: toolEvent.agentType,
      decisionLogic: toolEvent.decisionLogic,
      createdAt: toolEvent.createdAt,
    };
  }
}
