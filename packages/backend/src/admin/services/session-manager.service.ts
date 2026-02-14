/**
 * Session Manager Service
 *
 * Admin operations for session management including force kill and restart.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { SessionService } from '../../sessions/session.service';
import { Message } from '../../messages/entities/message.entity';
import { ToolEvent } from '../../messages/entities/tool-event.entity';
import { ThinkingBlock } from '../../messages/entities/thinking-block.entity';
import { ProcessLifecycleEvent } from '../../messages/entities/process-lifecycle-event.entity';
import { ApiErrorEvent } from '../../messages/entities/api-error-event.entity';
import { TokenUsageEvent } from '../../messages/entities/token-usage-event.entity';
import { Session } from '../entities/session.entity';
import { AuditService } from './audit.service';
import {
  SessionQueryDto,
  SessionListItem,
  SessionDetail,
  SessionTimeline,
  SessionTimelineEvent,
  RecentSession,
  TokenBreakdown,
} from '../dto/admin.dto';
import type { ManagedSession } from '../../common/interfaces';

export interface PaginatedSessions {
  items: SessionListItem[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
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
  ) {}

  /**
   * Get all sessions with filtering (database-backed with in-memory fallback)
   */
  async getSessions(query: SessionQueryDto): Promise<PaginatedSessions> {
    const offset = query.offset || 0;
    const limit = query.limit || 20;

    // Try database first
    try {
      return await this.getSessionsFromDatabase(query, offset, limit);
    } catch (error) {
      this.logger.warn(
        `Database query failed, falling back to in-memory sessions: ${error.message}`,
      );
      // Fallback to in-memory sessions for backward compatibility
      return await this.getSessionsFromMemory(query, offset, limit);
    }
  }

  /**
   * Get sessions from database (preferred method)
   */
  private async getSessionsFromDatabase(
    query: SessionQueryDto,
    offset: number,
    limit: number,
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
      .take(limit)
      .getMany();

    // Enrich with in-memory process status
    const memorySessionsMap = new Map(
      this.getAllManagedSessions().map((s) => [s.sessionId, s]),
    );

    const items: SessionListItem[] = sessions.map((session) => {
      const memorySession = memorySessionsMap.get(session.sessionId);
      return {
        sessionId: session.sessionId,
        tenantId: session.tenantId,
        clientId: session.clientId,
        status: session.status,
        messageCount: session.messageCount,
        totalTokens: session.totalTokens,
        estimatedCost: session.estimatedCost,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        hasActiveProcess:
          memorySession?.cliProcess !== null && !memorySession?.cliProcess?.killed,
      };
    });

    return { items, total, limit, offset };
  }

  /**
   * Get sessions from in-memory (fallback method)
   */
  private async getSessionsFromMemory(
    query: SessionQueryDto,
    offset: number,
    limit: number,
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
    const paginated = filtered.slice(offset, offset + limit);

    // Batch query token stats for all sessions
    const sessionIds = paginated.map((s) => s.sessionId);
    const tokenStats = await this.getTokenStatsBatch(sessionIds);

    const items: SessionListItem[] = paginated.map((session) => {
      const stats = tokenStats.get(session.sessionId) || {
        totalTokens: 0,
        estimatedCost: 0,
      };
      return {
        sessionId: session.sessionId,
        tenantId: session.tenantId || null,
        clientId: session.clientId,
        status: session.status,
        messageCount: session.messageCount,
        totalTokens: stats.totalTokens,
        estimatedCost: stats.estimatedCost,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        hasActiveProcess: session.cliProcess !== null && !session.cliProcess.killed,
      };
    });

    return { items, total, limit, offset };
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
      return {
        sessionId: session.sessionId,
        tenantId: session.tenantId || null,
        clientId: session.clientId,
        status: session.status,
        messageCount: session.messageCount,
        totalTokens: stats.totalTokens,
        estimatedCost: stats.estimatedCost,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        hasActiveProcess: true,
      };
    });
  }

  /**
   * Get session detail
   */
  async getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      return null;
    }

    // Get token stats for this session
    const tokenStats = await this.getTokenStatsBatch([sessionId]);
    const stats = tokenStats.get(sessionId) || {
      totalTokens: 0,
      estimatedCost: 0,
    };

    return {
      sessionId: session.sessionId,
      tenantId: session.tenantId || null,
      clientId: session.clientId,
      status: session.status,
      messageCount: session.messageCount,
      totalTokens: stats.totalTokens,
      estimatedCost: stats.estimatedCost,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      hasActiveProcess: session.cliProcess !== null && !session.cliProcess.killed,
      workspaceDir: session.workspaceDir,
    };
  }

  /**
   * Get session timeline with all events
   */
  async getSessionTimeline(
    sessionId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<SessionTimeline> {
    // Fetch all event types for the session
    const [messages, toolEvents, thinkingBlocks, processEvents, apiErrors] =
      await Promise.all([
        this.messageRepository.find({
          where: { sessionId },
          order: { createdAt: 'ASC' },
        }),
        this.toolEventRepository.find({
          where: { sessionId },
          order: { createdAt: 'ASC' },
        }),
        this.thinkingBlockRepository.find({
          where: { sessionId },
          order: { createdAt: 'ASC' },
        }),
        this.processEventRepository.find({
          where: { sessionId },
          order: { createdAt: 'ASC' },
        }),
        this.apiErrorRepository.find({
          where: { sessionId },
          order: { createdAt: 'ASC' },
        }),
      ]);

    // Convert to timeline events
    const events: SessionTimelineEvent[] = [];

    for (const msg of messages) {
      events.push({
        id: msg.id,
        type: 'message',
        timestamp: msg.createdAt,
        data: {
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata,
          messageIndex: msg.messageIndex,
        },
      });
    }

    for (const tool of toolEvents) {
      events.push({
        id: tool.id,
        type: 'tool_event',
        timestamp: tool.createdAt,
        data: {
          toolName: tool.toolName,
          phase: tool.phase,
          input: tool.toolInput,
          output: tool.toolOutput,
          durationMs: tool.durationMs,
          success: tool.success,
        },
      });
    }

    for (const thinking of thinkingBlocks) {
      events.push({
        id: thinking.id,
        type: 'thinking_block',
        timestamp: thinking.createdAt,
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
      events.push({
        id: error.id,
        type: 'api_error',
        timestamp: error.createdAt,
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
   * Force kill a session
   */
  async killSession(sessionId: string, adminId: string): Promise<boolean> {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

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
   */
  async bulkKillSessions(
    sessionIds: string[],
    adminId: string,
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
      sessionIds.map((sessionId) => this.killSession(sessionId, adminId)),
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
      'session.bulk_kill' as any,
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
   */
  async getTokenBreakdown(sessionId: string): Promise<TokenBreakdown | null> {
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
