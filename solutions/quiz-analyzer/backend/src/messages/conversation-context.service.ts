import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ConversationContext } from '../database/entities';

export interface CreateConversationContextDto {
  sessionId: string;
  tenantId?: string;
  systemPromptHash?: string;
  skillConfigHashes?: Array<{ slug: string; hash: string }>;
  mcpToolsList?: string[];
  model?: string;
  workspaceDir?: string;
  clientId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ConversationContextService {
  constructor(
    @InjectRepository(ConversationContext)
    private contextRepository: Repository<ConversationContext>,
  ) {}

  async createContext(dto: CreateConversationContextDto): Promise<ConversationContext> {
    const context = this.contextRepository.create({
      id: `ctx_${uuidv4()}`,
      session_id: dto.sessionId,
      tenant_id: dto.tenantId || null,
      system_prompt_hash: dto.systemPromptHash || null,
      skill_config_hashes: dto.skillConfigHashes ? JSON.stringify(dto.skillConfigHashes) : null,
      mcp_tools_list: dto.mcpToolsList ? JSON.stringify(dto.mcpToolsList) : null,
      model: dto.model || null,
      workspace_dir: dto.workspaceDir || null,
      client_id: dto.clientId || null,
      metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
    });

    return this.contextRepository.save(context);
  }

  async getContextBySession(sessionId: string): Promise<ConversationContext | null> {
    return this.contextRepository.findOne({
      where: { session_id: sessionId },
    });
  }
}
