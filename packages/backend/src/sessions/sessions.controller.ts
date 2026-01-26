/**
 * Sessions Controller
 *
 * RESTful API for session management and message completion.
 * WebSocket is used only for server-to-client streaming events.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ChatGateway } from '../chat/chat.gateway';
import { SessionService } from '../chat/session.service';
import { SkillSyncService } from '../skills/skill-sync.service';
import { TenantsService } from '../tenants/tenants.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationContextService } from '../messages/conversation-context.service';
import { CreateCompletionDto, CancelCompletionDto } from './dto/create-completion.dto';
import type { FrontendEvent } from '../common/interfaces';

@Controller('api/v1/sessions')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly sessionService: SessionService,
    private readonly skillSyncService: SkillSyncService,
    private readonly tenantsService: TenantsService,
    private readonly messagesService: MessagesService,
    private readonly conversationContextService: ConversationContextService,
  ) {}

  /**
   * Create completion (send message)
   * POST /api/v1/sessions/:sessionId/completion
   *
   * The response streams via WebSocket events to the connected client.
   */
  @Post(':sessionId/completion')
  async createCompletion(
    @Param('sessionId') sessionId: string,
    @Body() data: CreateCompletionDto,
  ) {
    const { clientId, message, tenantId, mcpServers, skillPath, enabledSkillSlugs } = data;

    this.logger.log(`Creating completion for session ${sessionId}`);

    // Find WebSocket connection
    const socket = this.chatGateway.getClientSocket(clientId);
    if (!socket) {
      throw new BadRequestException('Client not connected via WebSocket');
    }

    // Require tenantId for skill sync
    if (!tenantId) {
      this.logger.error('tenantId is required for chat - skills cannot be loaded without a tenant');
      socket.emit('agent_status', {
        status: 'error',
        sessionId,
        error: 'tenantId is required. Skills cannot be loaded without a tenant.',
      });
      throw new BadRequestException('tenantId is required');
    }

    try {
      // Resolve tenant slug/id to actual tenant UUID
      let resolvedTenantId = tenantId;
      try {
        const tenant = await this.tenantsService.findOne(tenantId);
        if (tenant) {
          resolvedTenantId = tenant.id;
          this.logger.debug(`Resolved tenant ${tenantId} to UUID ${resolvedTenantId}`);
        } else {
          this.logger.warn(`Tenant not found: ${tenantId}, using as-is`);
        }
      } catch (error) {
        this.logger.warn(`Failed to resolve tenant: ${error}`);
      }

      // Get or create session
      const session = this.sessionService.getOrCreateSession(sessionId, clientId, socket);

      // Store tenant context
      session.tenantId = resolvedTenantId;

      // Store MCP servers configuration
      if (mcpServers && Object.keys(mcpServers).length > 0) {
        session.mcpServers = mcpServers;
        this.logger.log(`Session ${sessionId} configured with MCP servers: ${Object.keys(mcpServers).join(', ')}`);
      }

      // Sync tenant skills to session workspace
      try {
        const syncResult = await this.skillSyncService.syncToSession(
          session.workspaceDir,
          resolvedTenantId,
          {
            publishedOnly: true,
            skillSlugs: enabledSkillSlugs,
          },
        );
        session.skillSyncedAt = new Date();
        this.logger.log(`Synced ${syncResult.skillCount} skills for tenant ${tenantId} (${resolvedTenantId})`);
      } catch (error) {
        this.logger.warn(`Failed to sync skills: ${error}`);
      }

      // If solution provided a skill file path, copy it to session workspace
      if (skillPath && fs.existsSync(skillPath)) {
        try {
          const skillName = path.basename(path.dirname(skillPath));
          const targetDir = path.join(session.workspaceDir, '.claude', 'skills', skillName);
          fs.mkdirSync(targetDir, { recursive: true });
          fs.copyFileSync(skillPath, path.join(targetDir, 'SKILL.md'));
          this.logger.log(`Copied skill ${skillName} to session workspace from ${skillPath}`);
        } catch (error) {
          this.logger.warn(`Failed to copy skill file: ${error}`);
        }
      }

      // Create message records for persistence
      const userMessage = await this.messagesService.create({
        sessionId,
        tenantId: resolvedTenantId,
        role: 'user',
        content: message,
      });

      const assistantMessage = await this.messagesService.create({
        sessionId,
        tenantId: resolvedTenantId,
        role: 'assistant',
        content: '', // Will be accumulated as response streams in
      });

      // Store message IDs on session for file association
      session.currentUserMessageId = userMessage.id;
      session.currentAssistantMessageId = assistantMessage.id;

      this.logger.debug(
        `Created messages: user=${userMessage.id}, assistant=${assistantMessage.id}`,
      );

      // Create or update ConversationContext (on first message)
      if (session.messageCount === 0) {
        try {
          await this.conversationContextService.createOrUpdate({
            sessionId,
            tenantId: resolvedTenantId,
            workspaceDir: session.workspaceDir,
            clientId,
          });
          this.logger.debug(`Created conversation context for session ${sessionId}`);
        } catch (err) {
          this.logger.warn(`Failed to create conversation context: ${err}`);
        }
      }

      // Notify frontend that agent is starting
      socket.emit('agent_status', {
        status: 'running',
        sessionId,
      });

      // Track accumulated text for message update
      let accumulatedText = '';

      // Event handler that also accumulates text
      const handleEvent = (event: FrontendEvent) => {
        // Accumulate text_delta events
        if (event.type === 'text_delta' && (event as any).text) {
          accumulatedText += (event as any).text;
        }

        // Emit to client
        socket.emit(event.type, event);

        // On completion, update the assistant message with accumulated content
        if (event.type === 'agent_status' && (event as any).status === 'complete') {
          this.messagesService
            .updateContent(assistantMessage.id, accumulatedText)
            .catch((err) => this.logger.error(`Failed to update message content: ${err}`));
        }
      };

      // Check if this is a follow-up message
      if (session.messageCount > 0) {
        // Follow-up message - use --resume
        await this.sessionService.sendFollowUp(session, message, handleEvent);
      } else {
        // First message - spawn new CLI process
        await this.sessionService.ensureCLIProcess(session, message, handleEvent);
      }

      return { success: true, sessionId };
    } catch (error) {
      this.logger.error(`Error creating completion: ${error}`);
      socket.emit('agent_status', {
        status: 'error',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Cancel completion
   * DELETE /api/v1/sessions/:sessionId/completion
   */
  @Delete(':sessionId/completion')
  cancelCompletion(
    @Param('sessionId') sessionId: string,
    @Body() data: CancelCompletionDto,
  ) {
    this.logger.log(`Cancelling completion for session ${sessionId}`);

    const socket = this.chatGateway.getClientSocket(data.clientId);
    if (!socket) {
      throw new BadRequestException('Client not connected');
    }

    const session = this.sessionService.getSession(sessionId);
    if (session) {
      this.sessionService.cancelSession(sessionId);
      socket.emit('agent_status', { status: 'cancelled', sessionId });
    }

    return { success: true };
  }

  /**
   * Get session status
   * GET /api/v1/sessions/:sessionId
   */
  @Get(':sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    const status = this.sessionService.getSessionStatus(sessionId);
    if (!status) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
    return status;
  }

  /**
   * Restart session
   * POST /api/v1/sessions/:sessionId/restart
   */
  @Post(':sessionId/restart')
  restartSession(
    @Param('sessionId') sessionId: string,
    @Body() body?: { tenantId?: string },
  ) {
    const success = this.sessionService.restartSession(sessionId, body?.tenantId);
    if (!success) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
    return { success: true };
  }
}
