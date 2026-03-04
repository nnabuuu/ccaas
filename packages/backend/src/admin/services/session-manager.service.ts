/**
 * Session Manager Service
 *
 * Admin operations for session management including force kill and restart.
 */

import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionService } from '../../sessions/session.service';
import { EventMapperService } from '../../sessions/event-mapper.service';
import { Message } from '../../messages/entities/message.entity';
import { ToolEvent } from '../../messages/entities/tool-event.entity';
import { ThinkingBlock } from '../../messages/entities/thinking-block.entity';
import { ProcessLifecycleEvent } from '../../messages/entities/process-lifecycle-event.entity';
import { ApiErrorEvent } from '../../messages/entities/api-error-event.entity';
import { TokenUsageEvent } from '../../messages/entities/token-usage-event.entity';
import { Session } from '../entities/session.entity';
import { Turn } from '../entities/turn.entity';
import { AuditService } from './audit.service';
import {
  SessionQueryDto,
  SessionListItem,
  SessionDetail,
  SessionTimeline,
  SessionTimelineEvent,
  RecentSession,
  TokenBreakdown,
  TurnSummary,
} from '../dto/admin.dto';
import type { ManagedSession, WorkspaceFileInfo, WorkspaceTreeResponse } from '../../common/interfaces';
import type { ApiKeyScope } from '../../auth/types';

export interface PaginatedSessions {
  data: SessionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
    private readonly eventMapper: EventMapperService,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(ToolEvent)
    private readonly toolEventRepository: Repository<ToolEvent>,
    @InjectRepository(ThinkingBlock)
    private readonly thinkingBlockRepository: Repository<ThinkingBlock>,
    @InjectRepository(ProcessLifecycleEvent)
    private readonly processEventRepository: Repository<ProcessLifecycleEvent>,
    @InjectRepository(ApiErrorEvent)
    private readonly apiErrorRepository: Repository<ApiErrorEvent>,
    @InjectRepository(TokenUsageEvent)
    private readonly tokenUsageRepository: Repository<TokenUsageEvent>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Turn)
    private readonly turnRepository: Repository<Turn>,
  ) {}

  private isAdminCaller(scopes?: ApiKeyScope[]): boolean {
    return scopes?.includes('admin') ?? false;
  }

  /**
   * Enforce tenant isolation for non-admin callers.
   *
   * Defense-in-depth: the @Auth('admin') guard on the controller already
   * verifies admin scope before requests reach this service. This check
   * protects against direct service invocations from non-admin contexts.
   *
   * Deny-by-default: sessions with a null/undefined tenantId are treated as
   * tenant-owned data, not shared resources. Non-admin callers cannot access
   * them unless the session's tenantId matches their own.
   */
  private assertTenantAccess(
    sessionTenantId: string | null | undefined,
    callerTenantId: string,
    callerScopes?: ApiKeyScope[],
  ): void {
    if (this.isAdminCaller(callerScopes)) return; // admin: no restriction
    if (sessionTenantId !== callerTenantId) {
      throw new ForbiddenException('Cannot access sessions belonging to another tenant');
    }
  }

  /**
   * Map session data to SessionListItem DTO.
   * Centralizes the mapping logic to avoid duplication.
   */
  private toSessionListItem(
    session: ManagedSession | Session,
    tokenStats: { totalTokens: number; estimatedCost: number },
    hasActiveProcess?: boolean,
  ): SessionListItem {
    // Determine if session has active process
    const isActive =
      hasActiveProcess !== undefined
        ? hasActiveProcess
        : 'cliProcess' in session && session.cliProcess !== null && !session.cliProcess.killed;

    // Extract title and isPinned from Session entity (not available on ManagedSession)
    const title = 'title' in session ? (session as Session).title : null;
    const isPinned = 'isPinned' in session ? (session as Session).isPinned : false;

    return {
      sessionId: session.sessionId,
      tenantId: session.tenantId || null,
      clientId: session.clientId,
      status: session.status,
      messageCount: session.messageCount,
      totalTokens: tokenStats.totalTokens,
      estimatedCost: tokenStats.estimatedCost,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      hasActiveProcess: isActive,
      title,
      isPinned,
    };
  }

  /**
   * Resolve pagination parameters from query.
   * Supports both page/pageSize (preferred) and offset/limit (legacy).
   * Returns normalized { page, pageSize, offset }.
   */
  private resolvePagination(query: SessionQueryDto): {
    page: number;
    pageSize: number;
    offset: number;
  } {
    const MAX_PAGE_SIZE = 250;
    const DEFAULT_PAGE_SIZE = 50;

    // Determine if caller used page/pageSize (new) or offset/limit (legacy)
    const hasPageParams =
      query.page !== undefined || query.pageSize !== undefined;

    let page: number;
    let pageSize: number;
    let offset: number;

    if (hasPageParams) {
      // New page/pageSize style (takes precedence)
      page = Math.max(1, query.page ?? 1);
      pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, query.pageSize ?? DEFAULT_PAGE_SIZE));
      offset = (page - 1) * pageSize;
    } else if (query.offset !== undefined || query.limit !== undefined) {
      // Legacy offset/limit style
      offset = Math.max(0, query.offset ?? 0);
      pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, query.limit ?? DEFAULT_PAGE_SIZE));
      // Derive page from offset for the response
      page = Math.floor(offset / pageSize) + 1;
    } else {
      // No pagination params: defaults
      page = 1;
      pageSize = DEFAULT_PAGE_SIZE;
      offset = 0;
    }

    return { page, pageSize, offset };
  }

  /**
   * Get all sessions with filtering (database-backed with in-memory fallback)
   */
  async getSessions(query: SessionQueryDto): Promise<PaginatedSessions> {
    const { page, pageSize, offset } = this.resolvePagination(query);

    // Try database first
    try {
      return await this.getSessionsFromDatabase(query, offset, pageSize, page);
    } catch (error) {
      this.logger.warn(
        `Database query failed, falling back to in-memory sessions: ${error.message}`,
      );
      // Fallback to in-memory sessions for backward compatibility
      return await this.getSessionsFromMemory(query, offset, pageSize, page);
    }
  }

  /**
   * Get sessions from database (preferred method)
   */
  private async getSessionsFromDatabase(
    query: SessionQueryDto,
    offset: number,
    pageSize: number,
    page: number,
  ): Promise<PaginatedSessions> {
    // Build query with filters
    const qb = this.sessionRepository.createQueryBuilder('session');

    if (query.tenantId) {
      qb.andWhere('session.tenantId = :tenantId', { tenantId: query.tenantId });
    }

    if (query.status) {
      qb.andWhere('session.status = :status', { status: query.status });
    }

    if (query.startDate) {
      qb.andWhere('session.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('session.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply pagination and sorting
    const sessions = await qb
      .orderBy('session.lastActivity', 'DESC')
      .skip(offset)
      .take(pageSize)
      .getMany();

    // Enrich with in-memory process status
    const memorySessionsMap = new Map(
      this.getAllManagedSessions().map((s) => [s.sessionId, s]),
    );

    const data: SessionListItem[] = sessions.map((session) => {
      const memorySession = memorySessionsMap.get(session.sessionId);
      const hasActiveProcess = !!memorySession?.cliProcess && !memorySession.cliProcess.killed;
      return this.toSessionListItem(
        session,
        { totalTokens: session.totalTokens, estimatedCost: session.estimatedCost },
        hasActiveProcess,
      );
    });

    return { data, total, page, pageSize };
  }

  /**
   * Get sessions from in-memory (fallback method)
   */
  private async getSessionsFromMemory(
    query: SessionQueryDto,
    offset: number,
    pageSize: number,
    page: number,
  ): Promise<PaginatedSessions> {
    const allSessions = this.getAllManagedSessions();

    // Filter sessions
    let filtered = allSessions;

    if (query.tenantId) {
      filtered = filtered.filter((s) => s.tenantId === query.tenantId);
    }

    if (query.status) {
      filtered = filtered.filter((s) => s.status === query.status);
    }

    if (query.startDate) {
      const startDate = new Date(query.startDate);
      filtered = filtered.filter((s) => s.createdAt >= startDate);
    }

    if (query.endDate) {
      const endDate = new Date(query.endDate);
      filtered = filtered.filter((s) => s.createdAt <= endDate);
    }

    // Sort by lastActivity descending
    filtered.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + pageSize);

    // Batch query token stats for all sessions
    const sessionIds = paginated.map((s) => s.sessionId);
    const tokenStats = await this.getTokenStatsBatch(sessionIds);

    const data: SessionListItem[] = paginated.map((session) => {
      const stats = tokenStats.get(session.sessionId) || {
        totalTokens: 0,
        estimatedCost: 0,
      };
      return this.toSessionListItem(session, stats);
    });

    return { data, total, page, pageSize };
  }

  /**
   * Get active sessions (currently processing)
   */
  async getActiveSessions(): Promise<SessionListItem[]> {
    const allSessions = this.getAllManagedSessions();
    const activeSessions = allSessions.filter(
      (s) =>
        s.status === 'processing' ||
        (s.cliProcess !== null && !s.cliProcess.killed),
    );

    // Get token stats for active sessions
    const sessionIds = activeSessions.map((s) => s.sessionId);
    const tokenStats = await this.getTokenStatsBatch(sessionIds);

    return activeSessions.map((session) => {
      const stats = tokenStats.get(session.sessionId) || {
        totalTokens: 0,
        estimatedCost: 0,
      };
      return this.toSessionListItem(session, stats, true); // hasActiveProcess = true
    });
  }

  /**
   * Get session detail
   * @param sessionId - Session ID to get details for
   * @param callerTenantId - Tenant ID of the caller (for authorization)
   */
  async getSessionDetail(
    sessionId: string,
    callerTenantId: string,
    callerScopes?: ApiKeyScope[],
  ): Promise<SessionDetail | null> {
    // Try in-memory first (active sessions), fall back to DB (historical sessions)
    const memSession = this.sessionService.getSession(sessionId);
    const session: ManagedSession | Session | null =
      memSession ?? (await this.sessionRepository.findOne({ where: { sessionId } })) ?? null;

    if (!session) {
      return null;
    }

    this.assertTenantAccess(session.tenantId, callerTenantId, callerScopes);

    // Get token stats for this session
    const tokenStats = await this.getTokenStatsBatch([sessionId]);
    const stats = tokenStats.get(sessionId) || {
      totalTokens: 0,
      estimatedCost: 0,
    };

    const hasActiveProcess = memSession
      ? (memSession.cliProcess !== null && !memSession.cliProcess.killed)
      : false;

    return {
      ...this.toSessionListItem(session, stats, hasActiveProcess),
      workspaceDir: session.workspaceDir ?? '',
    };
  }

  /**
   * Get session timeline with all events
   * @param sessionId - Session ID to get timeline for
   * @param limit - Maximum number of events to return
   * @param offset - Offset for pagination
   * @param callerTenantId - Tenant ID of the caller (for authorization)
   * @param callerScopes - API key scopes of the caller
   * @param turnNumber - Optional turn number to filter events to a specific turn
   */
  async getSessionTimeline(
    sessionId: string,
    limit: number = 100,
    offset: number = 0,
    callerTenantId: string,
    callerScopes?: ApiKeyScope[],
    turnNumber?: number,
  ): Promise<SessionTimeline> {
    // Check tenant access against memory or DB — historical sessions must be protected too
    const session =
      this.sessionService.getSession(sessionId) ??
      (await this.sessionRepository.findOne({ where: { sessionId } }));
    if (session) {
      this.assertTenantAccess(session.tenantId, callerTenantId, callerScopes);
    }

    // Build messageId→turnNumber map from turns
    const turns = await this.turnRepository.find({
      where: { sessionId },
      order: { turnNumber: 'ASC' },
    });

    const messageIdToTurnNumber = new Map<string, number>();
    for (const turn of turns) {
      messageIdToTurnNumber.set(turn.userMessageId, turn.turnNumber);
      if (turn.assistantMessageId) {
        messageIdToTurnNumber.set(turn.assistantMessageId, turn.turnNumber);
      }
    }

    // If filtering by turnNumber, resolve the turn's messageIds
    // Note: turnNumber is 0-based. `!== undefined` is intentional (0 is a valid turn)
    let turnMessageIds: Set<string> | null = null;
    if (turnNumber !== undefined) {
      const targetTurn = turns.find(t => t.turnNumber === turnNumber);
      if (!targetTurn) {
        return { sessionId, events: [], totalEvents: 0 };
      }
      turnMessageIds = new Set<string>();
      turnMessageIds.add(targetTurn.userMessageId);
      if (targetTurn.assistantMessageId) {
        turnMessageIds.add(targetTurn.assistantMessageId);
      }
    }

    // Safety bounds: Prevent OOM by limiting per-table query size
    const safetyLimit = Math.min(1000, (limit + offset) * 2);

    // Fetch all event types for the session with safety bounds
    // When filtering by turn, use messageId IN (...) for tables that have messageId
    const [messages, toolEvents, thinkingBlocks, processEvents, apiErrors] =
      await Promise.all([
        this.queryMessages(sessionId, safetyLimit, turnMessageIds),
        this.queryToolEvents(sessionId, safetyLimit, turnMessageIds),
        this.queryThinkingBlocks(sessionId, safetyLimit, turnMessageIds),
        // ProcessLifecycleEvents have no messageId — skip when filtering by turn
        turnMessageIds
          ? Promise.resolve([])
          : this.processEventRepository.find({
              where: { sessionId },
              order: { createdAt: 'ASC' },
              take: safetyLimit,
            }),
        this.queryApiErrors(sessionId, safetyLimit, turnMessageIds),
      ]);

    // Convert to timeline events with messageId and turnNumber enrichment
    const events: SessionTimelineEvent[] = [];

    for (const msg of messages) {
      events.push({
        id: msg.id,
        type: 'message',
        timestamp: msg.createdAt,
        messageId: msg.id,
        turnNumber: messageIdToTurnNumber.get(msg.id) ?? null,
        data: {
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata,
          messageIndex: msg.messageIndex,
        },
      });
    }

    for (const tool of toolEvents) {
      const toolMessageId = tool.messageId || null;
      const toolTurnNumber = toolMessageId ? (messageIdToTurnNumber.get(toolMessageId) ?? null) : null;

      events.push({
        id: tool.id,
        type: 'tool_event',
        timestamp: tool.createdAt,
        messageId: toolMessageId,
        turnNumber: toolTurnNumber,
        data: {
          toolName: tool.toolName,
          phase: tool.phase,
          input: tool.toolInput,
          output: tool.toolOutput,
          durationMs: tool.durationMs,
          success: tool.success,
        },
      });

      // Derive output_update from end-phase tool results (mirrors EventMapperService.handleSpecialToolResult)
      if (tool.phase === 'end' && tool.toolOutput && tool.success !== false) {
        const derived = this.deriveOutputUpdate(tool, toolMessageId, toolTurnNumber);
        if (derived) {
          events.push(derived);
        }
      }
    }

    for (const thinking of thinkingBlocks) {
      const thinkingMessageId = thinking.messageId || null;
      events.push({
        id: thinking.id,
        type: 'thinking_block',
        timestamp: thinking.createdAt,
        messageId: thinkingMessageId,
        turnNumber: thinkingMessageId ? (messageIdToTurnNumber.get(thinkingMessageId) ?? null) : null,
        data: {
          status: thinking.status,
          content: thinking.content,
          thinkingTokens: thinking.thinkingTokens,
          durationMs: thinking.durationMs,
        },
      });
    }

    for (const process of processEvents) {
      events.push({
        id: process.id,
        type: 'process_event',
        timestamp: process.createdAt,
        messageId: null,
        turnNumber: null,
        data: {
          eventType: process.eventType,
          pid: process.pid,
          exitCode: process.exitCode,
          signal: process.signal,
          errorMessage: process.errorMessage,
        },
      });
    }

    for (const error of apiErrors) {
      const errorMessageId = error.messageId || null;
      events.push({
        id: error.id,
        type: 'api_error',
        timestamp: error.createdAt,
        messageId: errorMessageId,
        turnNumber: errorMessageId ? (messageIdToTurnNumber.get(errorMessageId) ?? null) : null,
        data: {
          errorType: error.errorType,
          errorCode: error.errorCode,
          errorMessage: error.errorMessage,
          retryAttempt: error.retryAttempt,
          wasRetried: error.wasRetried,
          statusCode: error.statusCode,
        },
      });
    }

    // Sort by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const totalEvents = events.length;
    const paginatedEvents = events.slice(offset, offset + limit);

    return {
      sessionId,
      events: paginatedEvents,
      totalEvents,
    };
  }

  /**
   * Get turn summaries for a session
   */
  async getSessionTurns(
    sessionId: string,
    callerTenantId: string,
    callerScopes?: ApiKeyScope[],
  ): Promise<TurnSummary[]> {
    const session =
      this.sessionService.getSession(sessionId) ??
      (await this.sessionRepository.findOne({ where: { sessionId } }));
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
    this.assertTenantAccess(session.tenantId, callerTenantId, callerScopes);

    const turns = await this.turnRepository.find({
      where: { sessionId },
      order: { turnNumber: 'ASC' },
    });

    if (turns.length === 0) return [];

    // Collect all assistant messageIds for aggregate queries
    const assistantMessageIds = turns
      .map(t => t.assistantMessageId)
      .filter((id): id is string => id !== null);

    // Batch queries for aggregated turn stats
    const [toolCounts, thinkingMessageIds, errorMessageIds] = await Promise.all([
      // Count end-phase tool events per assistant messageId
      assistantMessageIds.length > 0
        ? this.toolEventRepository
            .createQueryBuilder('te')
            .select('te.messageId', 'messageId')
            .addSelect('COUNT(*)', 'cnt')
            .where('te.messageId IN (:...ids)', { ids: assistantMessageIds })
            .andWhere('te.phase = :phase', { phase: 'end' })
            .groupBy('te.messageId')
            .getRawMany<{ messageId: string; cnt: string }>()
        : Promise.resolve([] as { messageId: string; cnt: string }[]),

      // Find assistant messageIds that have thinking blocks
      assistantMessageIds.length > 0
        ? this.thinkingBlockRepository
            .createQueryBuilder('tb')
            .select('DISTINCT tb.messageId', 'messageId')
            .where('tb.messageId IN (:...ids)', { ids: assistantMessageIds })
            .getRawMany<{ messageId: string }>()
        : Promise.resolve([] as { messageId: string }[]),

      // Find assistant messageIds that have api errors
      assistantMessageIds.length > 0
        ? this.apiErrorRepository
            .createQueryBuilder('ae')
            .select('DISTINCT ae.messageId', 'messageId')
            .where('ae.messageId IN (:...ids)', { ids: assistantMessageIds })
            .getRawMany<{ messageId: string }>()
        : Promise.resolve([] as { messageId: string }[]),
    ]);

    const toolCountMap = new Map(toolCounts.map(r => [r.messageId, parseInt(r.cnt, 10)]));
    const thinkingSet = new Set(thinkingMessageIds.map(r => r.messageId));
    const errorSet = new Set(errorMessageIds.map(r => r.messageId));

    return turns.map(turn => ({
      turnId: turn.id,
      turnNumber: turn.turnNumber,
      userMessageId: turn.userMessageId,
      assistantMessageId: turn.assistantMessageId,
      totalTokens: turn.totalTokens,
      durationMs: turn.durationMs,
      createdAt: turn.createdAt,
      completedAt: turn.completedAt,
      toolCount: turn.assistantMessageId ? (toolCountMap.get(turn.assistantMessageId) ?? 0) : 0,
      hasThinking: turn.assistantMessageId ? thinkingSet.has(turn.assistantMessageId) : false,
      hasErrors: turn.assistantMessageId ? errorSet.has(turn.assistantMessageId) : false,
    }));
  }

  /**
   * Force kill a session
   * @param sessionId - Session ID to kill
   * @param adminId - Admin performing the action
   * @param callerTenantId - Tenant ID of the caller (for authorization)
   */
  async killSession(
    sessionId: string,
    adminId: string,
    callerTenantId: string,
    callerScopes?: ApiKeyScope[],
  ): Promise<boolean> {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      // Distinguish "doesn't exist" from "exists but already closed"
      const dbSession = await this.sessionRepository.findOne({ where: { sessionId } });
      if (dbSession) {
        throw new BadRequestException(`Session ${sessionId} exists but has no active process to kill`);
      }
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    this.assertTenantAccess(session.tenantId, callerTenantId, callerScopes);

    const success = this.sessionService.cancelSession(sessionId);

    if (success) {
      await this.auditService.logSuccess(
        adminId,
        'session.kill',
        'session',
        sessionId,
        { clientId: session.clientId, status: session.status },
        session.tenantId,
      );
      this.logger.log(`Admin ${adminId} killed session ${sessionId}`);
    } else {
      await this.auditService.logFailure(
        adminId,
        'session.kill',
        'session',
        sessionId,
        'Session has no active process to kill',
        { clientId: session.clientId, status: session.status },
        session.tenantId,
      );
    }

    return success;
  }

  /**
   * Bulk kill multiple sessions
   * @param sessionIds - Array of session IDs to kill
   * @param adminId - Admin performing the action
   * @param callerTenantId - Tenant ID of the caller (for authorization)
   */
  async bulkKillSessions(
    sessionIds: string[],
    adminId: string,
    callerTenantId: string,
    callerScopes?: ApiKeyScope[],
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
    const results = await Promise.allSettled(
      sessionIds.map((sessionId) =>
        this.killSession(sessionId, adminId, callerTenantId, callerScopes),
      ),
    );

    const detailedResults = results.map((result, index) => ({
      sessionId: sessionIds[index],
      status: result.status === 'fulfilled' ? ('success' as const) : ('failed' as const),
      error:
        result.status === 'rejected'
          ? result.reason?.message || 'Unknown error'
          : undefined,
    }));

    const successCount = detailedResults.filter((r) => r.status === 'success').length;
    const failedCount = detailedResults.filter((r) => r.status === 'failed').length;

    // Log bulk operation
    await this.auditService.logSuccess(
      adminId,
      'session.bulk_kill',
      'session',
      'bulk',
      {
        totalRequested: sessionIds.length,
        successCount,
        failedCount,
        sessionIds,
      },
      undefined,
    );

    this.logger.log(
      `Admin ${adminId} bulk killed ${successCount}/${sessionIds.length} sessions`,
    );

    return {
      totalRequested: sessionIds.length,
      successCount,
      failedCount,
      results: detailedResults,
    };
  }

  /**
   * Get recent sessions (for dashboard)
   */
  async getRecentSessions(limit: number = 10, tenantId?: string): Promise<RecentSession[]> {
    let sessions = this.getAllManagedSessions();

    // Filter by tenant if specified
    if (tenantId) {
      sessions = sessions.filter((s) => s.tenantId === tenantId);
    }

    return sessions
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
      .slice(0, limit)
      .map((session) => ({
        sessionId: session.sessionId,
        tenantId: session.tenantId || null,
        status: session.status,
        messageCount: session.messageCount,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
      }));
  }

  /**
   * Get error rate in last 24 hours
   */
  async getErrorRate24h(tenantId?: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const errorQb = this.apiErrorRepository.createQueryBuilder('error')
      .where('error.createdAt >= :oneDayAgo', { oneDayAgo });

    const messageQb = this.messageRepository.createQueryBuilder('message')
      .where('message.createdAt >= :oneDayAgo', { oneDayAgo });

    if (tenantId) {
      errorQb.andWhere('error.tenantId = :tenantId', { tenantId });
      messageQb.andWhere('message.tenantId = :tenantId', { tenantId });
    }

    const [errorCount, totalMessages] = await Promise.all([
      errorQb.getCount(),
      messageQb.getCount(),
    ]);

    if (totalMessages === 0) return 0;
    // Return as decimal (0-1) for API consistency, frontend will convert to percentage
    return Math.round((errorCount / totalMessages) * 10000) / 10000;
  }

  /**
   * Get token breakdown for a specific session
   * @param sessionId - Session ID to get token breakdown for
   * @param callerTenantId - Tenant ID of the caller (for authorization)
   */
  async getTokenBreakdown(
    sessionId: string,
    callerTenantId: string,
    callerScopes?: ApiKeyScope[],
  ): Promise<TokenBreakdown | null> {
    // Check tenant access against memory or DB — historical sessions must be protected too
    const session =
      this.sessionService.getSession(sessionId) ??
      (await this.sessionRepository.findOne({ where: { sessionId } }));
    if (session) {
      this.assertTenantAccess(session.tenantId, callerTenantId, callerScopes);
    }

    const result = await this.tokenUsageRepository
      .createQueryBuilder('usage')
      .select('SUM(usage.inputTokens)', 'inputTokens')
      .addSelect('SUM(usage.outputTokens)', 'outputTokens')
      .addSelect('SUM(usage.cachedInputTokens)', 'cachedInputTokens')
      .addSelect('SUM(usage.cacheReadTokens)', 'cacheReadTokens')
      .addSelect('SUM(usage.cacheCreationTokens)', 'cacheCreationTokens')
      .addSelect('SUM(usage.reasoningTokens)', 'reasoningTokens')
      .addSelect('SUM(usage.estimatedCostUsd)', 'estimatedCost')
      .where('usage.sessionId = :sessionId', { sessionId })
      .getRawOne();

    if (!result || result.inputTokens === null) {
      return null;
    }

    const totalTokens =
      (result.inputTokens || 0) +
      (result.outputTokens || 0) +
      (result.cachedInputTokens || 0) +
      (result.reasoningTokens || 0);

    return {
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      cachedInputTokens: result.cachedInputTokens || 0,
      cacheReadTokens: result.cacheReadTokens || 0,
      cacheCreationTokens: result.cacheCreationTokens || 0,
      reasoningTokens: result.reasoningTokens || 0,
      totalTokens,
      estimatedCost: result.estimatedCost || 0,
    };
  }

  /**
   * Get workspace file tree for a session
   * @param sessionId - Session ID to get workspace tree for
   */
  async getWorkspaceTree(sessionId: string): Promise<WorkspaceTreeResponse> {
    return this.sessionService.getWorkspaceTree(sessionId);
  }

  /**
   * Get a workspace file for a session
   * @param sessionId - Session ID
   * @param filePath - Relative path to the file within the workspace
   */
  async getWorkspaceFile(sessionId: string, filePath: string): Promise<WorkspaceFileInfo> {
    return this.sessionService.getWorkspaceFile(sessionId, filePath);
  }

  /**
   * Get file content from session workspace for inline viewing
   * @param sessionId - Session ID
   * @param filePath - Relative path to the file within the workspace
   */
  async getWorkspaceFileContent(
    sessionId: string,
    filePath: string,
  ): Promise<{ content: string | null; mimeType: string; size: number; filename: string; isBinary: boolean }> {
    return this.sessionService.getWorkspaceFileContent(sessionId, filePath);
  }

  // ===========================================================================
  // Session Sync Methods (Dual-Write Pattern)
  // ===========================================================================

  /**
   * Sync a single in-memory session to database
   * This enables gradual migration from memory-only to database-backed sessions
   */
  async syncSessionToDatabase(managedSession: ManagedSession): Promise<void> {
    try {
      // Get token stats for this session
      const tokenStats = await this.getTokenStatsBatch([managedSession.sessionId]);
      const stats = tokenStats.get(managedSession.sessionId) || {
        totalTokens: 0,
        estimatedCost: 0,
      };

      // Upsert session to database
      await this.sessionRepository.save({
        sessionId: managedSession.sessionId,
        tenantId: managedSession.tenantId || null,
        clientId: managedSession.clientId,
        status: managedSession.status,
        messageCount: managedSession.messageCount,
        totalTokens: stats.totalTokens,
        estimatedCost: stats.estimatedCost,
        createdAt: managedSession.createdAt,
        lastActivity: managedSession.lastActivity,
        closedAt:
          managedSession.status === 'closed' ? managedSession.lastActivity : null,
        workspaceDir: managedSession.workspaceDir,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to sync session ${managedSession.sessionId} to database: ${error.message}`,
      );
    }
  }

  /**
   * Sync all in-memory sessions to database
   * Useful for initial migration or periodic sync
   */
  async syncAllSessionsToDatabase(): Promise<number> {
    const memorySessions = this.getAllManagedSessions();
    let syncedCount = 0;

    for (const session of memorySessions) {
      await this.syncSessionToDatabase(session);
      syncedCount++;
    }

    this.logger.log(`Synced ${syncedCount} sessions to database`);
    return syncedCount;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  // ===========================================================================
  // Turn-aware query helpers
  // ===========================================================================

  private async queryMessages(
    sessionId: string,
    limit: number,
    turnMessageIds: Set<string> | null,
  ): Promise<Message[]> {
    if (turnMessageIds) {
      const ids = [...turnMessageIds];
      if (ids.length === 0) return [];
      return this.messageRepository
        .createQueryBuilder('m')
        .where('m.sessionId = :sessionId', { sessionId })
        .andWhere('m.id IN (:...ids)', { ids })
        .orderBy('m.createdAt', 'ASC')
        .take(limit)
        .getMany();
    }
    return this.messageRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  private async queryToolEvents(
    sessionId: string,
    limit: number,
    turnMessageIds: Set<string> | null,
  ): Promise<ToolEvent[]> {
    if (turnMessageIds) {
      const ids = [...turnMessageIds];
      if (ids.length === 0) return [];
      return this.toolEventRepository
        .createQueryBuilder('te')
        .where('te.sessionId = :sessionId', { sessionId })
        .andWhere('te.messageId IN (:...ids)', { ids })
        .orderBy('te.createdAt', 'ASC')
        .take(limit)
        .getMany();
    }
    return this.toolEventRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  private async queryThinkingBlocks(
    sessionId: string,
    limit: number,
    turnMessageIds: Set<string> | null,
  ): Promise<ThinkingBlock[]> {
    if (turnMessageIds) {
      const ids = [...turnMessageIds];
      if (ids.length === 0) return [];
      return this.thinkingBlockRepository
        .createQueryBuilder('tb')
        .where('tb.sessionId = :sessionId', { sessionId })
        .andWhere('tb.messageId IN (:...ids)', { ids })
        .orderBy('tb.createdAt', 'ASC')
        .take(limit)
        .getMany();
    }
    return this.thinkingBlockRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  private async queryApiErrors(
    sessionId: string,
    limit: number,
    turnMessageIds: Set<string> | null,
  ): Promise<ApiErrorEvent[]> {
    if (turnMessageIds) {
      const ids = [...turnMessageIds];
      if (ids.length === 0) return [];
      // ApiErrorEvent.messageId is nullable, so only filter if we have turn messageIds
      return this.apiErrorRepository
        .createQueryBuilder('ae')
        .where('ae.sessionId = :sessionId', { sessionId })
        .andWhere('ae.messageId IN (:...ids)', { ids })
        .orderBy('ae.createdAt', 'ASC')
        .take(limit)
        .getMany();
    }
    return this.apiErrorRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  private deriveOutputUpdate(
    tool: ToolEvent,
    messageId: string | null,
    turnNumber: number | null,
  ): SessionTimelineEvent | null {
    const normalizedName = tool.toolName
      .replace(/^mcp__[^_]+__/, '')
      .replace(/^mcp__/, '');

    // Check if this tool has a registered trigger (from bundles or solution config)
    let isTriggerTool = false;
    if (tool.tenantId) {
      const triggers = this.eventMapper.getTenantToolTriggers(tool.tenantId);
      isTriggerTool = triggers.some(
        t => t.toolName === normalizedName && t.eventType === 'output_update',
      );
    }

    if (!isTriggerTool) return null;

    const parsed = this.parseToolOutput(tool.toolOutput);
    return {
      id: `${tool.id}-output`,
      type: 'output_update',
      timestamp: tool.createdAt,
      messageId,
      turnNumber,
      data: {
        toolName: tool.toolName,
        data: parsed?.data || parsed,
        status: (parsed?.status as string) || 'unknown',
        progress: parsed?.progress,
      },
    };
  }

  private parseToolOutput(output: unknown): Record<string, any> | null {
    if (!output) return null;
    if (typeof output === 'string') {
      try { return JSON.parse(output); } catch { return { raw: output }; }
    }
    if (Array.isArray(output)) {
      const textBlock = output.find((b: any) => b.type === 'text' && typeof b.text === 'string');
      if (textBlock) {
        try { return JSON.parse(textBlock.text); } catch { return { raw: textBlock.text }; }
      }
      return null;
    }
    if (typeof output === 'object' && output !== null) return output as Record<string, any>;
    return null;
  }

  /**
   * Batch query token stats for multiple sessions
   * @returns Map of sessionId -> {totalTokens, estimatedCost}
   */
  private async getTokenStatsBatch(
    sessionIds: string[],
  ): Promise<Map<string, { totalTokens: number; estimatedCost: number }>> {
    if (sessionIds.length === 0) {
      return new Map();
    }

    const results = await this.tokenUsageRepository
      .createQueryBuilder('usage')
      .select('usage.sessionId', 'sessionId')
      .addSelect(
        'SUM(usage.inputTokens + usage.outputTokens + usage.cachedInputTokens + usage.reasoningTokens)',
        'totalTokens',
      )
      .addSelect('SUM(usage.estimatedCostUsd)', 'estimatedCost')
      .where('usage.sessionId IN (:...sessionIds)', { sessionIds })
      .groupBy('usage.sessionId')
      .getRawMany();

    const statsMap = new Map<string, { totalTokens: number; estimatedCost: number }>();
    for (const result of results) {
      statsMap.set(result.sessionId, {
        totalTokens: result.totalTokens || 0,
        estimatedCost: result.estimatedCost || 0,
      });
    }

    return statsMap;
  }

  private getAllManagedSessions(): ManagedSession[] {
    return this.sessionService.getAllSessions();
  }
}
