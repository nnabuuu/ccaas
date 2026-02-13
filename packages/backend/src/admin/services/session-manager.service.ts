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
import { AuditService } from './audit.service';
import {
  SessionQueryDto,
  SessionListItem,
  SessionDetail,
  SessionTimeline,
  SessionTimelineEvent,
  RecentSession,
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
  ) {}

  /**
   * Get all sessions with filtering
   */
  async getSessions(query: SessionQueryDto): Promise<PaginatedSessions> {
    const stats = this.sessionService.getStats();
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
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    const paginated = filtered.slice(offset, offset + limit);

    const items: SessionListItem[] = paginated.map((session) => ({
      sessionId: session.sessionId,
      tenantId: session.tenantId || null,
      clientId: session.clientId,
      status: session.status,
      messageCount: session.messageCount,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      hasActiveProcess: session.cliProcess !== null && !session.cliProcess.killed,
    }));

    return { items, total, limit, offset };
  }

  /**
   * Get active sessions (currently processing)
   */
  async getActiveSessions(): Promise<SessionListItem[]> {
    const allSessions = this.getAllManagedSessions();

    return allSessions
      .filter(
        (s) =>
          s.status === 'processing' ||
          (s.cliProcess !== null && !s.cliProcess.killed),
      )
      .map((session) => ({
        sessionId: session.sessionId,
        tenantId: session.tenantId || null,
        clientId: session.clientId,
        status: session.status,
        messageCount: session.messageCount,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        hasActiveProcess: true,
      }));
  }

  /**
   * Get session detail
   */
  async getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      tenantId: session.tenantId || null,
      clientId: session.clientId,
      status: session.status,
      messageCount: session.messageCount,
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

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private getAllManagedSessions(): ManagedSession[] {
    return this.sessionService.getAllSessions();
  }
}
