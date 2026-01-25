/**
 * Tool Events Service
 *
 * Manages persistence of tool invocation events (start/end phases).
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToolEvent, ToolEventPhase, ToolDecisionLogic } from './entities/tool-event.entity';

export interface CreateToolEventDto {
  messageId: string;
  sessionId: string;
  tenantId?: string | null;
  toolUseId: string;
  toolName: string;
  phase: ToolEventPhase;
  toolInput?: Record<string, unknown> | null;
  toolOutput?: unknown;
  success?: boolean | null;
  durationMs?: number | null;
  agentType?: string | null;
  decisionLogic?: ToolDecisionLogic | null;
}

export interface ToolEventQueryDto {
  sessionId?: string;
  messageId?: string;
  toolName?: string;
  phase?: ToolEventPhase;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ToolEventsService {
  private readonly logger = new Logger(ToolEventsService.name);

  constructor(
    @InjectRepository(ToolEvent)
    private readonly toolEventRepository: Repository<ToolEvent>,
  ) {}

  /**
   * Create a tool event record (start or end phase)
   */
  async create(dto: CreateToolEventDto): Promise<ToolEvent> {
    const toolEvent = this.toolEventRepository.create({
      messageId: dto.messageId,
      sessionId: dto.sessionId,
      tenantId: dto.tenantId ?? undefined,
      toolUseId: dto.toolUseId,
      toolName: dto.toolName,
      phase: dto.phase,
      toolInput: dto.toolInput || null,
      toolOutput: dto.toolOutput ?? null,
      success: dto.success ?? null,
      durationMs: dto.durationMs ?? null,
      agentType: dto.agentType || null,
      decisionLogic: dto.decisionLogic || null,
    });

    const saved = await this.toolEventRepository.save(toolEvent);
    this.logger.debug(
      `Created tool event ${saved.id}: ${dto.toolName} (${dto.phase}) for message ${dto.messageId}`,
    );
    return saved;
  }

  /**
   * Record tool start event
   */
  async recordStart(params: {
    messageId: string;
    sessionId: string;
    tenantId?: string | null;
    toolUseId: string;
    toolName: string;
    toolInput?: Record<string, unknown>;
    agentType?: string;
    decisionLogic?: ToolDecisionLogic;
  }): Promise<ToolEvent> {
    return this.create({
      messageId: params.messageId,
      sessionId: params.sessionId,
      tenantId: params.tenantId,
      toolUseId: params.toolUseId,
      toolName: params.toolName,
      phase: 'start',
      toolInput: params.toolInput,
      agentType: params.agentType,
      decisionLogic: params.decisionLogic,
    });
  }

  /**
   * Record tool end event
   */
  async recordEnd(params: {
    messageId: string;
    sessionId: string;
    tenantId?: string | null;
    toolUseId: string;
    toolName: string;
    toolInput?: Record<string, unknown>;
    toolOutput?: unknown;
    success: boolean;
    durationMs?: number;
    agentType?: string;
  }): Promise<ToolEvent> {
    return this.create({
      messageId: params.messageId,
      sessionId: params.sessionId,
      tenantId: params.tenantId,
      toolUseId: params.toolUseId,
      toolName: params.toolName,
      phase: 'end',
      toolInput: params.toolInput,
      toolOutput: params.toolOutput,
      success: params.success,
      durationMs: params.durationMs,
      agentType: params.agentType,
    });
  }

  /**
   * Find tool events by message ID
   */
  async findByMessageId(messageId: string): Promise<ToolEvent[]> {
    return this.toolEventRepository.find({
      where: { messageId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Find tool events by session ID
   */
  async findBySessionId(sessionId: string): Promise<ToolEvent[]> {
    return this.toolEventRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Find tool events by tool use ID (to link start/end)
   */
  async findByToolUseId(toolUseId: string): Promise<ToolEvent[]> {
    return this.toolEventRepository.find({
      where: { toolUseId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Query tool events with filters
   */
  async query(dto: ToolEventQueryDto): Promise<ToolEvent[]> {
    const qb = this.toolEventRepository
      .createQueryBuilder('toolEvent')
      .orderBy('toolEvent.createdAt', 'ASC');

    if (dto.sessionId) {
      qb.andWhere('toolEvent.sessionId = :sessionId', { sessionId: dto.sessionId });
    }

    if (dto.messageId) {
      qb.andWhere('toolEvent.messageId = :messageId', { messageId: dto.messageId });
    }

    if (dto.toolName) {
      qb.andWhere('toolEvent.toolName = :toolName', { toolName: dto.toolName });
    }

    if (dto.phase) {
      qb.andWhere('toolEvent.phase = :phase', { phase: dto.phase });
    }

    if (dto.limit) {
      qb.take(dto.limit);
    }

    if (dto.offset) {
      qb.skip(dto.offset);
    }

    return qb.getMany();
  }

  /**
   * Get tool event statistics for a session
   */
  async getSessionStats(sessionId: string): Promise<{
    totalEvents: number;
    toolCounts: Record<string, number>;
    successCount: number;
    errorCount: number;
    avgDurationMs: number;
  }> {
    const events = await this.findBySessionId(sessionId);
    const endEvents = events.filter((e) => e.phase === 'end');

    const toolCounts: Record<string, number> = {};
    let successCount = 0;
    let errorCount = 0;
    let totalDuration = 0;
    let durationCount = 0;

    for (const event of endEvents) {
      toolCounts[event.toolName] = (toolCounts[event.toolName] || 0) + 1;
      if (event.success === true) successCount++;
      if (event.success === false) errorCount++;
      if (event.durationMs != null) {
        totalDuration += event.durationMs;
        durationCount++;
      }
    }

    return {
      totalEvents: events.length,
      toolCounts,
      successCount,
      errorCount,
      avgDurationMs: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    };
  }

  /**
   * Delete all tool events for a session
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    const result = await this.toolEventRepository.delete({ sessionId });
    this.logger.debug(`Deleted ${result.affected} tool events for session ${sessionId}`);
    return result.affected || 0;
  }

  /**
   * Delete all tool events for a message
   */
  async deleteByMessageId(messageId: string): Promise<number> {
    const result = await this.toolEventRepository.delete({ messageId });
    this.logger.debug(`Deleted ${result.affected} tool events for message ${messageId}`);
    return result.affected || 0;
  }
}
