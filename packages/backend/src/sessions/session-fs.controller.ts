/**
 * SessionFsController — REST surface for the AgentFS observability
 * + checkpoint operations.
 *
 *   GET   /api/v1/sessions/:id/fs/diff
 *   GET   /api/v1/sessions/:id/fs/timeline?limit=&filter=&status=
 *   POST  /api/v1/sessions/:id/fs/snapshot      body: { label }
 *   POST  /api/v1/sessions/:id/fs/rollback      body: { label }
 *
 * Auth: `Auth('admin')` for stage-1 (single coarse scope). Later we
 * can split into `sessions:fs` for tenant-bound calls + `admin` for
 * cross-tenant ops. TenantGuard already populates `req.tenantId`.
 *
 * 400 paths:
 *   - WORKSPACE_PROVIDER=local — service throws "requires agentfs"
 *   - invalid label format
 * 403: session belongs to a different tenant
 * 404: session not in the in-memory map (closed or not yet created)
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth } from '../auth/decorators';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { TenantGuard } from '../tenants/tenant.guard';
import { SessionFsService } from './services/session-fs.service';
import type { TimelineOpts } from './workspace/types';

interface LabelBody {
  label: string;
}

@ApiTags('sessions-fs')
@Controller('api/v1/sessions/:id/fs')
@UseGuards(TenantGuard)
export class SessionFsController {
  constructor(private readonly svc: SessionFsService) {}

  @Get('diff')
  @Auth('admin')
  diff(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.svc.diff(id, tenantId);
  }

  /**
   * `limit` is silently clamped to the [1, 1000] range (negative /
   * non-numeric values fall through to agentfs's default).
   * `filter` is restricted to `^[\w./*-]{1,256}$` — defense in depth
   * against unexpected CLI arg values, even though `execFile` doesn't
   * shell-interpret. `status` must be one of the three enum values
   * agentfs accepts.
   */
  @Get('timeline')
  @Auth('admin')
  timeline(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('filter') filter?: string,
    @Query('status') status?: string,
  ) {
    const opts: TimelineOpts = {};
    if (limit) {
      const n = Number(limit);
      if (Number.isFinite(n) && n > 0) opts.limit = Math.min(Math.floor(n), 1000);
    }
    if (filter) {
      if (!/^[\w./*-]{1,256}$/.test(filter)) {
        throw new BadRequestException(
          'filter must match ^[\\w./*-]{1,256}$',
        );
      }
      opts.filter = filter;
    }
    if (status === 'pending' || status === 'success' || status === 'error') {
      opts.status = status;
    }
    return this.svc.timeline(id, tenantId, opts);
  }

  @Post('snapshot')
  @Auth('admin')
  snapshot(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: LabelBody,
  ) {
    return this.svc.snapshot(id, tenantId, body?.label);
  }

  @Post('rollback')
  @Auth('admin')
  @HttpCode(204)
  async rollback(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: LabelBody,
  ): Promise<void> {
    await this.svc.rollback(id, tenantId, body?.label);
  }
}
