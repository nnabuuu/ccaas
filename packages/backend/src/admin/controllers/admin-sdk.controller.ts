/**
 * Admin SDK Controller
 *
 * Provides REST endpoints for monitoring SDK connections.
 */

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthAdminOrBuilder, Ctx } from '../../auth/decorators';
import { RequestContext } from '../../auth/types';
import { AdminSolutionAccessGuard, isAdminScope } from '../guards/admin-solution-access.guard';
import { SessionsGateway } from '../../sessions/sessions.gateway';

@ApiTags('admin')
@Controller('api/v1/admin/sdk-connections')
@AuthAdminOrBuilder()
@UseGuards(AdminSolutionAccessGuard)
export class AdminSdkController {
  constructor(private readonly sessionsGateway: SessionsGateway) {}

  /**
   * GET /api/v1/admin/sdk-connections
   *
   * Return all currently active SDK connections with metadata
   */
  @Get()
  async getConnections(@Ctx() ctx: RequestContext) {
    let connections = this.sessionsGateway.getSdkConnections();

    // Builder keys: filter to own tenant only
    if (!isAdminScope(ctx)) {
      connections = connections.filter((c) => c.solutionId === ctx.solutionId);
    }

    return {
      total: connections.length,
      connections,
    };
  }
}
