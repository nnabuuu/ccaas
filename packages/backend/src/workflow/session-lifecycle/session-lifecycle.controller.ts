/**
 * `SessionLifecycleController` — phase 5 M6 pass-1 S1. Cross-process
 * session-end signal that lets solutions free per-session state on
 * the platform side.
 *
 * Endpoint: DELETE /api/v1/workflow/sessions/:sessionId
 *
 * Calls `WorkflowEngineService.clearSession(sessionId)` which cascades
 * into `IndicatorRegistryService.clearSession` (M5 pass-1 SF1 wired
 * the cascade; this endpoint was the missing piece).
 *
 * Without this endpoint the `IndicatorRegistry` accumulates
 * `IndicatorDef[]` per session forever — every chat session leaks the
 * catalog until process restart. M6 made the leak strictly worse
 * because indicator pushes now fire on every session start with no
 * counterbalancing cleanup.
 *
 * Auth: `@Auth('chat')` — same scope as the events / indicators
 * ingest endpoints. Tenant-bound: the registry is keyed by
 * `(solutionId, sessionId)` so tenant A's DELETE only clears tenant
 * A's data (M5 pass-1 MF3 isolation). Tenant binding is required.
 */

import {
  BadRequestException,
  Controller,
  Delete,
  HttpCode,
  Param,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth, TenantId } from '../../auth/decorators';
import { WorkflowEngineService } from '../workflow-engine.service';
import { IndicatorRegistryService } from '../llm/indicator-registry.service';

@ApiTags('workflow')
@Controller('api/v1/workflow/sessions')
export class SessionLifecycleController {
  constructor(
    private readonly engine: WorkflowEngineService,
    private readonly indicators: IndicatorRegistryService,
  ) {}

  @Delete(':sessionId')
  @Auth('chat')
  @HttpCode(204)
  @ApiOperation({
    summary: '清理 session 的平台状态 / Clear session platform state',
    description:
      'Phase 5 M6 pass-1 S1: solutions call this on session end to free the per-session indicator catalog + drain the workflow engine queue. Idempotent — clearing an unknown session is a no-op 204.',
  })
  @ApiParam({ name: 'sessionId', description: '会话 ID / Session ID' })
  @ApiResponse({ status: 204, description: 'Session state cleared' })
  @ApiResponse({ status: 400, description: '校验失败 / Validation failed (missing tenant)' })
  async clearSession(
    @Param('sessionId') sessionId: string,
    @TenantId() solutionId: string | undefined,
  ): Promise<void> {
    if (!solutionId) {
      throw new BadRequestException(
        'solutionId not resolved from auth context; DELETE session requires a tenant-bound API key',
      );
    }
    // M6 pass-2 SF3: tenant-scoped teardown. Engine queue drain is
    // tenant-agnostic (the queue is keyed by sessionId only), but
    // indicator clear must respect the auth boundary so a chat key
    // from tenant A cannot drop tenant B's catalog. Bypass
    // `engine.clearSession` (which broad-clears indicators) — call
    // the narrow queue drain + the tenant-scoped indicator clear.
    this.engine.clearSessionQueue(sessionId);
    this.indicators.clearTenantSession(solutionId, sessionId);
  }
}
