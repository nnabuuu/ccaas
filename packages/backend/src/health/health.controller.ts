/**
 * Health Controller
 *
 * System health monitoring and status endpoints.
 * Provides quick health checks for load balancers and detailed status for monitoring systems.
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { Public, Auth } from '../auth/decorators';
import { HealthService } from './health.service';
import { SessionService } from '../sessions/session.service';

@ApiTags('System Health')
@Controller('api/v1')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly sessionService: SessionService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'System health check',
    description: 'Quick health check for load balancers',
  })
  async healthCheck() {
    const isHealthy = await this.healthService.checkCriticalDependencies();
    return {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
    };
  }

  @Auth('analytics:read')
  @ApiSecurity('api-key')
  @Get('status')
  @ApiOperation({
    summary: 'System status and metrics',
    description: 'Detailed system status including services and resources. Requires analytics:read scope.',
  })
  async getStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: await this.healthService.getServiceStatus(),
      resources: {
        sessions: this.sessionService.getStats(),
        uptime: process.uptime(),
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
        },
      },
    };
  }
}
