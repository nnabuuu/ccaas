import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { LintResult } from './lint.schema';
import { LintService } from './lint.service';

/**
 * AI lint endpoints. The frontend's Review tab calls both:
 *   GET   → cheap; returns cached state (idle / fresh / stale / pending / error)
 *   POST  → manual override; forces a fresh run + returns the result
 *
 * Auto-trigger on file save lives in ProjectService write hooks (not
 * here); these endpoints are only the read + manual-rerun surface.
 *
 * No body on POST — the run reads plan + manifest from the project's
 * stored files, not from the request. This avoids client-controlled
 * content being fed to the LLM.
 */
@ApiTags('lint')
@Controller('projects/:id/lint')
export class LintController {
  constructor(private readonly svc: LintService) {}

  @Get()
  @ApiOperation({
    summary: 'Get cached lint result (or idle if never run).',
    description:
      'Cheap read. Returns the current LintResult. If the cache is ' +
      'stale (content hash changed), status flips to "stale" and an ' +
      'auto-rerun is enqueued — poll until status becomes "fresh".',
  })
  get(@Param('id') id: string): Promise<LintResult> {
    return this.svc.getOrInit(id);
  }

  @Post('run')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Force a fresh lint run (manual override).',
    description:
      'Blocks until the LLM call completes. Concurrent callers share ' +
      'one in-flight run, so the manual button + a debounced auto-run ' +
      'cannot double-spend tokens.',
  })
  run(@Param('id') id: string): Promise<LintResult> {
    return this.svc.run(id);
  }
}
