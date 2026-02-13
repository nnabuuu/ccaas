/**
 * Admin SDK Controller
 *
 * Provides REST endpoints for monitoring SDK connections.
 */

import { Controller, Get } from '@nestjs/common';
import { Auth } from '../../auth/decorators';
import { SessionsGateway } from '../../sessions/sessions.gateway';

@Controller('api/v1/admin/sdk-connections')
@Auth('admin')
export class AdminSdkController {
  constructor(private readonly sessionsGateway: SessionsGateway) {}

  /**
   * GET /api/v1/admin/sdk-connections
   *
   * Return all currently active SDK connections with metadata
   */
  @Get()
  async getConnections() {
    const connections = this.sessionsGateway.getSdkConnections();

    return {
      total: connections.length,
      connections,
    };
  }
}
