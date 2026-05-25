/**
 * SessionMetadataController — REST surface for per-session KV metadata.
 *
 *   GET    /api/v1/sessions/:id/meta
 *   GET    /api/v1/sessions/:id/meta/:key
 *   PUT    /api/v1/sessions/:id/meta/:key   body: { value: unknown }
 *   DELETE /api/v1/sessions/:id/meta/:key   → 204
 *
 * Auth: `Auth('admin')` for stage-1. Tenant ownership enforced by the
 * service against the session's in-memory tenantId.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth } from '../auth/decorators';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { TenantGuard } from '../tenants/tenant.guard';
import { SessionMetadataService } from './services/session-metadata.service';

interface ValueBody {
  value: unknown;
}

@ApiTags('sessions-meta')
@Controller('api/v1/sessions/:id/meta')
@UseGuards(TenantGuard)
export class SessionMetadataController {
  constructor(private readonly svc: SessionMetadataService) {}

  @Get()
  @Auth('admin')
  list(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.svc.list(id, tenantId);
  }

  @Get(':key')
  @Auth('admin')
  get(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('key') key: string,
  ) {
    return this.svc.get(id, tenantId, key);
  }

  @Put(':key')
  @Auth('admin')
  put(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() body: ValueBody,
  ) {
    return this.svc.put(id, tenantId, key, body?.value);
  }

  @Delete(':key')
  @Auth('admin')
  @HttpCode(204)
  async delete(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('key') key: string,
  ): Promise<void> {
    await this.svc.delete(id, tenantId, key);
  }
}
