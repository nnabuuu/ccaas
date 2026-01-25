/**
 * Chat Controller
 *
 * REST endpoints for health checks and session status.
 */

import { Controller, Get, Post, Body, BadRequestException, Logger } from '@nestjs/common';
import { SessionService } from './session.service';
import { ChatGateway } from './chat.gateway';
import { ChatMessageDto } from './dto/chat-message.dto';

@Controller()
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
}
