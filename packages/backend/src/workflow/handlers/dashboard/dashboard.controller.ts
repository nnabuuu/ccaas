/**
 * `DashboardController` — phase 5 M5.2. Exposes
 * `DashboardService.buildPayload` over HTTP. **Sole** dashboard
 * endpoint after M5.2a deleted the legacy
 * `ObservationDashboardController` + `/observation-dashboard` route.
 * For the rationale behind the cutover (and what the legacy 4-array
 * shape was) see § "Legacy shape" of
 * `docs/gitbook/zh/ontology/dashboard-contract.md` +
 * `docs/ontology/PROGRESS.md` M5 row.
 *
 * Endpoint: GET /api/v1/workflow/sessions/:sessionId/dashboard
 *
 * Auth: `@Auth('chat')` matches the ingest endpoint convention.
 */

import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth, TenantId } from '../../../auth/decorators';
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
      'Returns the ontology-native `DashboardPayload` (students[] with linked status + metrics + raw observations + session indicator catalog). Sole dashboard endpoint after M5.2a deleted the legacy `/observation-dashboard` route.',
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiResponse({ status: 200, description: 'Dashboard payload' })
  async getDashboard(
    @Param('sessionId') sessionId: string,
    @TenantId() solutionId: string | undefined,
  ): Promise<DashboardPayload> {
    // M5 pass-1 MF3 / SF6: require a tenant binding. Without this any
    // `chat`-scoped key from tenant A could read tenant B's session
    // observations (data-leak vector).
    if (!solutionId) {
      throw new BadRequestException(
        'solutionId not resolved from auth context; GET dashboard requires a tenant-bound API key',
      );
    }
    return this.dashboards.buildPayload(solutionId, sessionId);
  }
}
