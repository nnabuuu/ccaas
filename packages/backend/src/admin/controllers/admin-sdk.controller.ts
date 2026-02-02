/**
 * Admin SDK Controller
 *
 * Provides REST endpoints for monitoring SDK connections.
 */

import { Controller, Get } from '@nestjs/common';
import { Auth } from '../../auth/decorators';
import { ChatGateway } from '../../chat/chat.gateway';

@Controller('api/v1/admin/sdk-connections')
@Auth('admin')
export class AdminSdkController {
  constructor(private readonly chatGateway: ChatGateway) {}

  /**
   * GET /api/v1/admin/sdk-connections
   *
   * Return all currently active SDK connections with metadata
   */
  @Get()
  async getConnections() {
    const connections = this.chatGateway.getSdkConnections();

    return {
      total: connections.length,
      connections,
    };
  }
}
