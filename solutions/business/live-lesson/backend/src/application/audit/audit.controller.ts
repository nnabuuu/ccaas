import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuditRunState } from './audit.schema';
import { AuditService } from './audit.service';

/**
 * AI audit HTTP surface. Both teacher (manual button) and agent (in
 * chat) hit the same endpoints:
 *
 *   GET  /api/projects/:id/audit       → current run state
 *   POST /api/projects/:id/audit/run   → trigger a run (async, 202)
 *
 * The actual report content lives in `audit/audit-report.md` and is
 * read via the existing `/api/projects/:id/files?path=...` endpoint
 * — no separate "get report" endpoint here.
 *
 * No request body on POST: file content is server-read from the
 * project's stored plan/manifest, never client-provided. Prevents
 * client-controlled content being fed to the LLM.
 */
@ApiTags('audit')
@Controller('projects/:id/audit')
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Current audit run state.',
    description:
      'Cheap read. Returns { status, lastGeneratedAt?, errorMessage?, reportPath }. ' +
      'Frontend polls this to track running → done transitions.',
  })
  getState(@Param('id') id: string): AuditRunState {
    return this.svc.getState(id);
  }

  @Post('run')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Trigger an audit run (async).',
    description:
      'Returns immediately with the running state. The LLM call + report ' +
      'write happen in the background; client should poll GET /audit ' +
      'until status flips to "done" or "error". Concurrent callers share ' +
      'the in-flight run — manual button + agent triggering at the same ' +
      "time will only consume one LLM call's worth of tokens.",
  })
  run(@Param('id') id: string): AuditRunState {
    return this.svc.run(id);
  }
}
