/**
 * Thinking Blocks Service
 *
 * Manages extended thinking (reasoning) content accumulation and storage.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThinkingBlock, ThinkingStatus } from './entities/thinking-block.entity';

export interface CreateThinkingBlockDto {
  messageId: string;
  sessionId: string;
  tenantId?: string | null;
  thinkingId: string;
  content?: string;
  sequenceNumber?: number;
  thinkingTokens?: number;
}

@Injectable()
export class ThinkingBlocksService {
  private readonly logger = new Logger(ThinkingBlocksService.name);

  // In-memory accumulator for streaming thinking content
  private activeBlocks = new Map<string, {
    block: ThinkingBlock;
    contentBuffer: string[];
    startTime: number;
  }>();

  constructor(
    @InjectRepository(ThinkingBlock)
    private readonly thinkingRepository: Repository<ThinkingBlock>,
  ) {}

  /**
   * Start a new thinking block (on reasoning-start event)
   */
  async startThinking(dto: CreateThinkingBlockDto): Promise<ThinkingBlock> {
    // Count existing blocks for this message to determine sequence number
    const existingCount = await this.thinkingRepository.count({
      where: { messageId: dto.messageId },
    });

    const block = this.thinkingRepository.create({
      messageId: dto.messageId,
      sessionId: dto.sessionId,
      tenantId: dto.tenantId ?? undefined,
      thinkingId: dto.thinkingId,
      content: dto.content || '',
      sequenceNumber: dto.sequenceNumber ?? existingCount,
      status: 'in_progress',
      startedAt: new Date(),
    });

    const saved = await this.thinkingRepository.save(block);

    // Store in memory for delta accumulation
    this.activeBlocks.set(dto.thinkingId, {
      block: saved,
      contentBuffer: dto.content ? [dto.content] : [],
      startTime: Date.now(),
    });

    this.logger.debug(
      `Started thinking block ${dto.thinkingId} for message ${dto.messageId}`,
    );
    return saved;
  }

  /**
   * Append delta to active thinking block (on reasoning-delta event)
   */
  async appendDelta(thinkingId: string, delta: string): Promise<void> {
    const active = this.activeBlocks.get(thinkingId);
    if (!active) {
      this.logger.warn(`No active thinking block found for ID ${thinkingId}`);
      return;
    }

    active.contentBuffer.push(delta);
  }

  /**
   * End a thinking block (on reasoning-end event)
   */
  async endThinking(
    thinkingId: string,
    thinkingTokens?: number,
  ): Promise<ThinkingBlock | null> {
    const active = this.activeBlocks.get(thinkingId);
    if (!active) {
      this.logger.warn(`No active thinking block found for ID ${thinkingId}`);
      return null;
    }

    const durationMs = Date.now() - active.startTime;
    const fullContent = active.contentBuffer.join('');

    // Update the block in database
    await this.thinkingRepository.update(active.block.id, {
      content: fullContent,
      status: 'complete',
      durationMs,
      thinkingTokens: thinkingTokens ?? null,
    });

    // Clean up memory
    this.activeBlocks.delete(thinkingId);

    const updated = await this.thinkingRepository.findOne({
      where: { id: active.block.id },
    });

    this.logger.debug(
      `Completed thinking block ${thinkingId} (${durationMs}ms, ${fullContent.length} chars)`,
    );

    return updated;
  }

  /**
   * Mark a thinking block as interrupted (e.g., on cancel)
   */
  async interruptThinking(
    thinkingId: string,
    reason?: string,
  ): Promise<ThinkingBlock | null> {
    const active = this.activeBlocks.get(thinkingId);
    if (!active) {
      return null;
    }

    const durationMs = Date.now() - active.startTime;
    const fullContent = active.contentBuffer.join('');

    await this.thinkingRepository.update(active.block.id, {
      content: fullContent,
      status: 'interrupted',
      interruptionReason: reason || null,
      durationMs,
    });

    this.activeBlocks.delete(thinkingId);

    return this.thinkingRepository.findOne({
      where: { id: active.block.id },
    });
  }

  /**
   * Get thinking blocks by message ID
   */
  async getByMessageId(messageId: string): Promise<ThinkingBlock[]> {
    return this.thinkingRepository.find({
      where: { messageId },
      order: { sequenceNumber: 'ASC' },
    });
  }

  /**
   * Get thinking blocks by session ID
   */
  async getBySessionId(sessionId: string): Promise<ThinkingBlock[]> {
    return this.thinkingRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get a single thinking block by thinkingId
   */
  async getByThinkingId(thinkingId: string): Promise<ThinkingBlock | null> {
    return this.thinkingRepository.findOne({
      where: { thinkingId },
    });
  }

  /**
   * Get session statistics for thinking blocks
   */
  async getSessionStats(sessionId: string): Promise<{
    totalBlocks: number;
    completedBlocks: number;
    interruptedBlocks: number;
    totalDurationMs: number;
    totalThinkingTokens: number;
    avgDurationMs: number;
  }> {
    const blocks = await this.getBySessionId(sessionId);

    let completedBlocks = 0;
    let interruptedBlocks = 0;
    let totalDurationMs = 0;
    let totalThinkingTokens = 0;
    let durationCount = 0;

    for (const block of blocks) {
      if (block.status === 'complete') completedBlocks++;
      if (block.status === 'interrupted') interruptedBlocks++;
      if (block.durationMs != null) {
        totalDurationMs += block.durationMs;
        durationCount++;
      }
      if (block.thinkingTokens != null) {
        totalThinkingTokens += block.thinkingTokens;
      }
    }

    return {
      totalBlocks: blocks.length,
      completedBlocks,
      interruptedBlocks,
      totalDurationMs,
      totalThinkingTokens,
      avgDurationMs: durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0,
    };
  }

  /**
   * Clean up any active blocks for a session (on session close)
   */
  async cleanupSession(sessionId: string): Promise<void> {
    for (const [thinkingId, active] of this.activeBlocks.entries()) {
      if (active.block.sessionId === sessionId) {
        await this.interruptThinking(thinkingId, 'session_closed');
      }
    }
  }

  /**
   * Delete all thinking blocks for a session
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    const result = await this.thinkingRepository.delete({ sessionId });
    return result.affected || 0;
  }
}
