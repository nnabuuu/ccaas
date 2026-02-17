/**
 * Conversation Metadata Service
 *
 * Manages conversation-level metadata (title, isPinned) stored in the Session entity.
 * Used by:
 * - SessionsGateway: Enriches reconnect response with conversation metadata
 * - CompletionOrchestrationService: Auto-generates title from first user message
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../../admin/entities/session.entity';

export interface ConversationMetadata {
  title: string | null;
  isPinned: boolean;
}

@Injectable()
export class ConversationMetadataService {
  private readonly logger = new Logger(ConversationMetadataService.name);

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  /**
   * Get conversation metadata for a session.
   * Used to enrich WebSocket reconnect responses.
   * Returns defaults if session not found or DB fails.
   *
   * @param sessionId - Session ID to look up
   * @param tenantId - Tenant ID for isolation (optional for backward compatibility)
   */
  async getConversationMetadata(
    sessionId: string,
    tenantId?: string,
  ): Promise<ConversationMetadata> {
    try {
      const where: Record<string, unknown> = { sessionId };
      if (tenantId) {
        where.tenantId = tenantId;
      }

      const session = await this.sessionRepository.findOne({ where });

      if (!session) {
        return { title: null, isPinned: false };
      }

      return {
        title: session.title,
        isPinned: session.isPinned,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to get conversation metadata for session ${sessionId}: ${message}`,
      );
      return { title: null, isPinned: false };
    }
  }

  /**
   * Auto-generate title from first user message.
   * Only sets title if session exists and has no title yet.
   * Non-critical: silently handles errors.
   */
  async autoGenerateTitle(sessionId: string, userMessage: string): Promise<void> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { sessionId },
      });

      if (!session) {
        return;
      }

      // Don't overwrite existing title
      if (session.title) {
        return;
      }

      // Generate title from message: trim, truncate to 100 chars
      const trimmed = userMessage.trim();
      const title = trimmed.length > 100
        ? trimmed.slice(0, 100) + '...'
        : trimmed;

      session.title = title;
      await this.sessionRepository.save(session);

      this.logger.debug(`Auto-generated title for session ${sessionId}: "${title}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to auto-generate title for session ${sessionId}: ${message}`,
      );
      // Non-critical: don't throw
    }
  }
}
