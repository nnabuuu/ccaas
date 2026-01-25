/**
 * Conversation Context Service
 *
 * Manages session-level causality context for conversation analysis.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationContext } from './entities/conversation-context.entity';

export interface CreateConversationContextDto {
  sessionId: string;
  tenantId?: string | null;
  systemPromptHash?: string | null;
  skillConfigHashes?: Array<{ slug: string; hash: string }> | null;
  mcpToolsList?: string[] | null;
  model?: string | null;
  workspaceDir?: string | null;
  clientId?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class ConversationContextService {
  private readonly logger = new Logger(ConversationContextService.name);

  constructor(
    @InjectRepository(ConversationContext)
    private readonly contextRepository: Repository<ConversationContext>,
  ) {}

  /**
   * Create or update conversation context for a session
   */
  async createOrUpdate(dto: CreateConversationContextDto): Promise<ConversationContext> {
    // Check if context already exists
    const existing = await this.contextRepository.findOne({
      where: { sessionId: dto.sessionId },
    });

    if (existing) {
      // Merge metadata
      const mergedMetadata = dto.metadata
        ? { ...(existing.metadata || {}), ...dto.metadata }
        : existing.metadata;

      // Update existing context - use type assertion for simple-json column
      const updateData: Partial<ConversationContext> = {
        tenantId: dto.tenantId ?? existing.tenantId,
        systemPromptHash: dto.systemPromptHash ?? existing.systemPromptHash,
        skillConfigHashes: dto.skillConfigHashes ?? existing.skillConfigHashes,
        mcpToolsList: dto.mcpToolsList ?? existing.mcpToolsList,
        model: dto.model ?? existing.model,
        workspaceDir: dto.workspaceDir ?? existing.workspaceDir,
        clientId: dto.clientId ?? existing.clientId,
        metadata: mergedMetadata,
      };
      await this.contextRepository.update(existing.id, updateData as any);
      this.logger.debug(`Updated conversation context for session ${dto.sessionId}`);
      return this.contextRepository.findOneOrFail({ where: { id: existing.id } });
    }

    // Create new context
    const context = this.contextRepository.create({
      sessionId: dto.sessionId,
      tenantId: dto.tenantId || null,
      systemPromptHash: dto.systemPromptHash || null,
      skillConfigHashes: dto.skillConfigHashes || null,
      mcpToolsList: dto.mcpToolsList || null,
      model: dto.model || null,
      workspaceDir: dto.workspaceDir || null,
      clientId: dto.clientId || null,
      metadata: dto.metadata || null,
    });

    const saved = await this.contextRepository.save(context);
    this.logger.debug(`Created conversation context for session ${dto.sessionId}`);
    return saved;
  }

  /**
   * Get conversation context by session ID
   */
  async getBySessionId(sessionId: string): Promise<ConversationContext | null> {
    return this.contextRepository.findOne({ where: { sessionId } });
  }

  /**
   * Get conversation context by ID
   */
  async getById(id: string): Promise<ConversationContext | null> {
    return this.contextRepository.findOne({ where: { id } });
  }

  /**
   * Update MCP tools list for a session
   */
  async updateMcpTools(sessionId: string, mcpToolsList: string[]): Promise<void> {
    const context = await this.getBySessionId(sessionId);
    if (context) {
      await this.contextRepository.update(context.id, { mcpToolsList });
    }
  }

  /**
   * Update model for a session
   */
  async updateModel(sessionId: string, model: string): Promise<void> {
    const context = await this.getBySessionId(sessionId);
    if (context) {
      await this.contextRepository.update(context.id, { model });
    }
  }

  /**
   * Delete conversation context for a session
   */
  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.contextRepository.delete({ sessionId });
    this.logger.debug(`Deleted conversation context for session ${sessionId}`);
  }
}
