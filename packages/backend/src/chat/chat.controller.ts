/**
 * Chat Controller
 *
 * REST endpoints for health checks and server status monitoring.
 */

import {
  Controller,
  Get,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SessionService } from './session.service';
import { Public } from '../auth/decorators';

@ApiTags('Chat (Health Check Only)')
@Controller('api/v1/chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Health check endpoint
   */
  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Health check endpoint for monitoring',
    description: 'Returns server health status. Used for monitoring and load balancer health checks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Server is healthy',
    schema: {
      properties: {
        status: { type: 'string', example: 'ok' },
      },
    },
  })
  healthCheck() {
    return { status: 'ok' };
  }

  /**
   * Server status endpoint
   */
  @Public()
  @Get('status')
  @ApiOperation({
    summary: 'Get server statistics and metrics',
    description: 'Returns server runtime statistics including session count, memory usage, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'Server statistics',
    schema: {
      properties: {
        authenticated: { type: 'boolean', example: true },
        status: { type: 'string', example: 'ready' },
        sessions: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 5 },
            active: { type: 'number', example: 2 },
            idle: { type: 'number', example: 3 },
          },
        },
      },
    },
  })
  agentStatus() {
    return {
      authenticated: true,
      status: 'ready',
      sessions: this.sessionService.getStats(),
    };
  }
}
