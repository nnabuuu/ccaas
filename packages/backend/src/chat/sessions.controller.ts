/**
 * Sessions Controller
 *
 * REST endpoints for session-specific operations.
 * Provides compatibility endpoint for react-sdk's useAgentChat hook.
 */

import {
  Controller,
  Post,
  Param,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { IsString, IsOptional, IsObject, IsArray } from 'class-validator';
import { SessionService } from './session.service';
import { ChatGateway } from './chat.gateway';

/**
 * DTO for session completion endpoint
 * Matches the payload sent by @ccaas/react-sdk useAgentChat hook
 */
export class SessionCompletionDto {
  @IsString()
  clientId: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsObject()
  mcpServers?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  skillPath?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledSkillSlugs?: string[];

  @IsOptional()
  @IsArray()
  attachments?: Array<{ name: string; content: string; mimeType: string }>;
}

@Controller('api/v1/sessions')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Session completion endpoint
   * This endpoint is called by @ccaas/react-sdk's useAgentChat hook
   *
   * POST /api/v1/sessions/:sessionId/completion
   */
  @Post(':sessionId/completion')
  async completeSession(
    @Param('sessionId') sessionId: string,
    @Body() data: SessionCompletionDto,
  ) {
    const { clientId, message, tenantId, mcpServers, skillPath, enabledSkillSlugs } = data;

    // Validate clientId
    if (!clientId) {
      throw new BadRequestException('clientId is required');
    }

    // Validate message
    if (!message) {
      throw new BadRequestException('message is required');
    }

    // Find WebSocket connection
    const socket = this.chatGateway.getClientSocket(clientId);
    if (!socket) {
      throw new BadRequestException('Client not connected via WebSocket');
    }

    this.logger.log(`Session completion request for session ${sessionId}, client ${clientId}`);

    try {
      const session = this.sessionService.getOrCreateSession(sessionId, clientId, socket);

      // Set tenant and MCP configuration
      if (tenantId) session.tenantId = tenantId;
      if (mcpServers) session.mcpServers = mcpServers as Record<string, any>;

      // Notify frontend that agent is starting
      socket.emit('agent_status', {
        status: 'running',
        sessionId,
      });

      // Start processing (async, response streams via WebSocket)
      if (session.messageCount > 0) {
        this.sessionService.sendFollowUp(session, message, (event) => {
          socket.emit(event.type, event);
        });
      } else {
        this.sessionService.ensureCLIProcess(session, message, (event) => {
          socket.emit(event.type, event);
        });
      }

      return { success: true, sessionId };
    } catch (error) {
      this.logger.error(`Error in completeSession: ${error}`);
      throw new BadRequestException(error instanceof Error ? error.message : 'Unknown error');
    }
  }
}
