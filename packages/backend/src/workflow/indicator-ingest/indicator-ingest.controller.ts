/**
 * `IndicatorIngestController` — phase 5 M5.3a. The cross-process
 * registration endpoint for `IndicatorRegistryService`.
 *
 * Why this endpoint exists: M4's LLM handlers
 * (`ChatTurnService`, `StatusChangeService`) read indicators from the
 * platform's `IndicatorRegistryService` — but no production caller
 * pushed them in. Result: the M4 cascade silently skipped every
 * chat_turn ("no indicators registered; skip") because the registry
 * was always empty in prod. The live-lesson backend has the
 * indicator catalog (read from the lesson manifest at session start)
 * and needs a wire path to register it on the platform side.
 *
 * Endpoint: PUT /api/v1/workflow/sessions/:sessionId/indicators
 * Body: `{ indicators: IndicatorDef[] }`
 *
 * Semantics: PUT (idempotent replace). Resending the same indicators
 * is a no-op; the registry's `setIndicators` is replace-on-write.
 *
 * Auth: `@Auth('chat')` — same scope as the events ingest controller.
 */

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Param,
  Put,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth, TenantId } from '../../auth/decorators';
import {
  IndicatorRegistryService,
  type IndicatorDef,
} from '../llm/indicator-registry.service';
import { PutIndicatorsDto } from './indicator-ingest.dto';

@ApiTags('workflow')
@Controller('api/v1/workflow/sessions')
export class IndicatorIngestController {
  constructor(private readonly indicators: IndicatorRegistryService) {}

  @Put(':sessionId/indicators')
  @Auth('chat')
  @HttpCode(204)
  @ApiOperation({
    summary: '注册 session 指标目录 / Register session indicator catalog',
    description:
      'A solution-side worker pushes the session indicator catalog so the platform\'s LLM-driven handlers can classify chat turns / observations against the right anchor set. PUT semantics (idempotent replace). Empty `indicators` array clears the session.',
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiResponse({ status: 204, description: 'Indicators replaced' })
  @ApiResponse({ status: 400, description: '校验失败 / Validation failed' })
  async putIndicators(
    @Param('sessionId') sessionId: string,
    @TenantId() solutionId: string | undefined,
    @Body() body: PutIndicatorsDto,
  ): Promise<void> {
    // M5 pass-1 MF3: require a tenant binding. Without this, any
    // `chat`-scoped key from tenant A could clobber tenant B's
    // catalog (IndicatorRegistry is keyed by `${solutionId}:${sessionId}`).
    // Matches EventIngestController:103-114.
    if (!solutionId) {
      throw new BadRequestException(
        'solutionId not resolved from auth context; PUT indicators requires a tenant-bound API key',
      );
    }
    const indicators: IndicatorDef[] = body.indicators.map((i) => ({
      id: i.id,
      type: i.type,
      label: i.label,
      description: i.description,
    }));
    this.indicators.setIndicators(solutionId, sessionId, indicators);
  }
}
