/**
 * User Context Service
 *
 * Tracks frontend page state and user context for analysis.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { UserContextEvent } from './entities/user-context-event.entity';

export interface CreateUserContextDto {
  sessionId: string;
  messageId?: string | null;
  pageUrl?: string | null;
  pageTitle?: string | null;
  selectedText?: string | null;
  customContext?: Record<string, unknown> | null;
  viewport?: { width: number; height: number } | null;
  darkMode?: boolean | null;
}

@Injectable()
export class UserContextService {
  private readonly logger = new Logger(UserContextService.name);

  constructor(
    @InjectRepository(UserContextEvent)
    private readonly contextRepository: Repository<UserContextEvent>,
  ) {}

  /**
   * Hash text for privacy (doesn't store actual content)
   */
  private hashText(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }

  /**
   * Record a user context event
   */
  async recordContext(dto: CreateUserContextDto): Promise<UserContextEvent> {
    const event = this.contextRepository.create({
      sessionId: dto.sessionId,
      messageId: dto.messageId || null,
      pageUrl: dto.pageUrl || null,
      pageTitle: dto.pageTitle || null,
      selectedTextHash: dto.selectedText ? this.hashText(dto.selectedText) : null,
      selectedTextLength: dto.selectedText?.length || null,
      customContext: this.sanitizeCustomContext(dto.customContext),
      viewport: dto.viewport || null,
      darkMode: dto.darkMode ?? null,
    });

    const saved = await this.contextRepository.save(event);
    this.logger.debug(
      `Recorded user context for session ${dto.sessionId}` +
        (dto.messageId ? ` (message: ${dto.messageId})` : ''),
    );
    return saved;
  }

  /**
   * Sanitize custom context to remove potential PII
   */
  private sanitizeCustomContext(
    context: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!context) return null;

    // Remove any keys that might contain PII
    const sensitiveKeys = ['password', 'token', 'api_key', 'secret', 'credit_card', 'ssn', 'email'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        continue;
      }

      // Truncate string values that are too long
      if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.slice(0, 500) + '...';
      } else if (typeof value === 'object' && value !== null) {
        // Don't include nested objects (could contain PII)
        sanitized[key] = '[object]';
      } else {
        sanitized[key] = value;
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : null;
  }

  /**
   * Get context events by session ID
   */
  async getBySessionId(sessionId: string): Promise<UserContextEvent[]> {
    return this.contextRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get context events by message ID
   */
  async getByMessageId(messageId: string): Promise<UserContextEvent[]> {
    return this.contextRepository.find({
      where: { messageId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get latest context for a session
   */
  async getLatest(sessionId: string): Promise<UserContextEvent | null> {
    return this.contextRepository.findOne({
      where: { sessionId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get context statistics for a session
   */
  async getSessionStats(sessionId: string): Promise<{
    totalContextEvents: number;
    uniqueUrls: number;
    avgSelectedTextLength: number | null;
    darkModeUsage: { dark: number; light: number; unknown: number };
  }> {
    const events = await this.getBySessionId(sessionId);

    const uniqueUrls = new Set<string>();
    let totalSelectedLength = 0;
    let selectedCount = 0;
    let darkCount = 0;
    let lightCount = 0;
    let unknownCount = 0;

    for (const event of events) {
      if (event.pageUrl) {
        uniqueUrls.add(event.pageUrl);
      }
      if (event.selectedTextLength != null) {
        totalSelectedLength += event.selectedTextLength;
        selectedCount++;
      }
      if (event.darkMode === true) darkCount++;
      else if (event.darkMode === false) lightCount++;
      else unknownCount++;
    }

    return {
      totalContextEvents: events.length,
      uniqueUrls: uniqueUrls.size,
      avgSelectedTextLength: selectedCount > 0
        ? Math.round(totalSelectedLength / selectedCount)
        : null,
      darkModeUsage: { dark: darkCount, light: lightCount, unknown: unknownCount },
    };
  }

  /**
   * Delete all context events for a session
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    const result = await this.contextRepository.delete({ sessionId });
    return result.affected || 0;
  }
}
