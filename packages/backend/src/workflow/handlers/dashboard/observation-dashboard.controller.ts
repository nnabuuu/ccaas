/**
 * `ObservationDashboardController` — phase 5 M3. Exposes the
 * `ObservationDashboardProjector`'s output over HTTP so the
 * live-lesson backend can fetch the legacy dashboard JSON without
 * reading from its own (now-stale during transition) observation
 * table.
 *
 * Endpoint: GET /api/v1/workflow/sessions/:sessionId/observation-dashboard
 *
 * Auth: `@Auth('chat')` matches the ingest endpoint convention.
 *
 * M5 will replace this with a richer ontology-native dashboard
 * endpoint AND delete the projector + this controller.
 */

import { Controller, Get, Header, Param } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators';
import {
  ObservationDashboardProjector,
  type ObservationDashboardPayload,
} from './observation-dashboard.projector';

@ApiTags('workflow')
@Controller('api/v1/workflow/sessions')
export class ObservationDashboardController {
  constructor(
    private readonly projector: ObservationDashboardProjector,
  ) {}

  @Get(':sessionId/observation-dashboard')
  @Auth('chat')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: '获取教师 dashboard 观察数据（projector 包装的 legacy shape） / Get observation dashboard (Path B projector output)',
    description:
      'Phase 5 M3 (Path B): returns the legacy `{logs, alerts, indicatorStats}` shape derived from platform-side `observations` rows. M5 replaces this with the ontology-native shape + deletes the projector.',
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiResponse({ status: 200, description: '观察 dashboard payload / Observation dashboard payload' })
  async getDashboard(
    @Param('sessionId') sessionId: string,
  ): Promise<ObservationDashboardPayload> {
    return this.projector.project(sessionId);
  }
}
