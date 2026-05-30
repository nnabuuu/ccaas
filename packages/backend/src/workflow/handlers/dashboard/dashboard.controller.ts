/**
 * `DashboardController` — phase 5 M5.2. Exposes
 * `DashboardService.buildPayload` over HTTP.
 *
 * Endpoint: GET /api/v1/workflow/sessions/:sessionId/dashboard
 *
 * Parallel to the M3 `ObservationDashboardController` (legacy
 * `{logs, alerts, indicatorStats}` shape, served at
 * `/observation-dashboard`). Both live concurrently during the M5
 * transition; the projector + its controller get deleted in the
 * M5 second pass (frontend rewrite) per the phase-5 plan.
 *
 * Auth: `@Auth('chat')` matches the projector + ingest endpoint
 * convention.
 */

import { Controller, Get, Header, Param } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators';
import { DashboardService } from './dashboard.service';
import type { DashboardPayload } from './dashboard-payload.types';

@ApiTags('workflow')
@Controller('api/v1/workflow/sessions')
export class DashboardController {
  constructor(private readonly dashboards: DashboardService) {}

  @Get(':sessionId/dashboard')
  @Auth('chat')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: '获取教师 dashboard（ontology-native shape）/ Get dashboard (ontology-native shape)',
    description:
      'Phase 5 M5.2: returns the ontology-native `DashboardPayload` (students[] with linked status + metrics + raw observations + session indicator catalog). M5 second pass migrates the frontend to this shape + deletes the legacy `/observation-dashboard` endpoint.',
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiResponse({ status: 200, description: 'Dashboard payload' })
  async getDashboard(
    @Param('sessionId') sessionId: string,
  ): Promise<DashboardPayload> {
    return this.dashboards.buildPayload(sessionId);
  }
}
