/**
 * Chat Controller
 *
 * REST endpoints for health checks and session status.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { ChatGateway } from './chat.gateway';
import { ChatMessageDto, SendMessageDto, CancelOperationDto } from './dto/chat-message.dto';

@Controller('api/v1/chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Health check endpoint
   */
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }

  /**
   * Agent status endpoint
   */
  @Get('agent/status')
  agentStatus() {
    return {
      authenticated: true,
      status: 'ready',
      sessions: this.sessionService.getStats(),
    };
  }

  /**
   * Initiate chat via REST (response streams via WebSocket)
   */
  @Post('agent/chat')
  async initiateChat(@Body() data: ChatMessageDto & { clientId?: string }) {
    const { message, clientId } = data;

    if (!message) {
      throw new BadRequestException('Message is required');
    }

    if (!clientId) {
      throw new BadRequestException('Client ID is required');
    }

    // Find the socket for this client
    const socket = this.chatGateway.getClientSocket(clientId);
    if (!socket) {
      throw new BadRequestException('Client not connected via WebSocket');
    }

    // Trigger chat via the gateway
    // We use emit to send to the gateway's handler
    this.logger.log(`REST chat initiated for client ${clientId}`);

    // Create a promise that resolves when we've started processing
    const sessionId = data.sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    try {
      const session = this.sessionService.getOrCreateSession(sessionId, clientId, socket);

      // Notify frontend that agent is starting
      socket.emit('agent_status', {
        status: 'running',
        sessionId,
      });

      // Start processing (async, response streams via WebSocket)
      if (session.messageCount > 0 || data.resumeSession) {
        this.sessionService.sendFollowUp(session, message, (event) => {
          socket.emit(event.type, event);
        });
      } else {
        this.sessionService.ensureCLIProcess(session, message, (event) => {
          socket.emit(event.type, event);
        });
      }

      return {
        success: true,
        sessionId,
        text: 'Message received, response streaming via WebSocket',
      };
    } catch (error) {
      this.logger.error(`Error initiating chat: ${error}`);
      throw new BadRequestException(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Send message via REST API (primary entry point for unidirectional WebSocket architecture)
   * Response streams via WebSocket events
   */
  @Post('send')
  async sendMessage(@Body() data: SendMessageDto) {
    const { clientId, message, sessionId, tenantId, resumeSession, mcpServers } = data;

    // Validate clientId
    if (!clientId) {
      throw new BadRequestException('clientId is required');
    }

    // Find WebSocket connection
    const socket = this.chatGateway.getClientSocket(clientId);
    if (!socket) {
      throw new BadRequestException('Client not connected via WebSocket');
    }

    // Get or create session
    const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    this.logger.log(`REST send initiated for client ${clientId}, session ${finalSessionId}`);

    try {
      const session = this.sessionService.getOrCreateSession(finalSessionId, clientId, socket);

      // Set tenant and MCP configuration
      if (tenantId) session.tenantId = tenantId;
      if (mcpServers) session.mcpServers = mcpServers;

      // Notify frontend that agent is starting
      socket.emit('agent_status', {
        status: 'running',
        sessionId: finalSessionId,
      });

      // Start processing (async, response streams via WebSocket)
      if (session.messageCount > 0 || resumeSession) {
        this.sessionService.sendFollowUp(session, message, (event) => {
          socket.emit(event.type, event);
        });
      } else {
        this.sessionService.ensureCLIProcess(session, message, (event) => {
          socket.emit(event.type, event);
        });
      }

      return { success: true, sessionId: finalSessionId };
    } catch (error) {
      this.logger.error(`Error in sendMessage: ${error}`);
      throw new BadRequestException(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Cancel current operation via REST API
   */
  @Post('cancel')
  async cancelOperation(@Body() data: CancelOperationDto) {
    const { clientId, sessionId } = data;

    const socket = this.chatGateway.getClientSocket(clientId);
    if (!socket) {
      throw new BadRequestException('Client not connected');
    }

    // Find session to cancel
    const session = sessionId
      ? this.sessionService.getSession(sessionId)
      : this.sessionService.getSessionByClientId(clientId);

    if (session) {
      this.sessionService.cancelSession(session.sessionId);
      socket.emit('agent_status', {
        status: 'cancelled',
        sessionId: session.sessionId,
      });
      this.logger.log(`Cancelled session ${session.sessionId} via REST`);
    }

    return { success: true };
  }

  /**
   * Get session status including restart flag
   */
  @Get('sessions/:sessionId/status')
  getSessionStatus(@Param('sessionId') sessionId: string) {
    const status = this.sessionService.getSessionStatus(sessionId);

    if (!status) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    return status;
  }

  /**
   * Restart a session to pick up new skills
   * Kills the CLI process so next message spawns fresh
   * Week 4: Enhanced with session details and proper error handling
   */
  @Post('sessions/:sessionId/restart')
  async restartSession(
    @Param('sessionId') sessionId: string,
    @Body() body?: { tenantId?: string },
  ) {
    // Check if session exists
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    // Check if session can be restarted
    if (!this.sessionService.canRestartSession(sessionId)) {
      throw new BadRequestException('Session cannot be restarted at this time');
    }

    // Restart session (async, may throw)
    await this.sessionService.restartSession(sessionId, body?.tenantId);

    // Get session details after restart
    const sessionDetails = this.sessionService.getSessionDetails(sessionId);

    return {
      success: true,
      message: 'Session restarted successfully',
      session: sessionDetails,
    };
  }

  /**
   * Get detailed session information
   * Week 4: New endpoint for session status and metadata
   */
  @Get('sessions/:sessionId/details')
  getSessionDetails(@Param('sessionId') sessionId: string) {
    const details = this.sessionService.getSessionDetails(sessionId);

    if (!details) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    return details;
  }
}
