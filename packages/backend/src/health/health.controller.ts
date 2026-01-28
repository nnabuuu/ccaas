/**
 * Health Controller
 *
 * Provides health check endpoint for the service.
 */

import { Controller, Get } from '@nestjs/common';

@Controller('api/v1')
export class HealthController {
  /**
   * Health check endpoint
   * GET /api/v1/health
   */
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
