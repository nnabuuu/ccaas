/**
 * SessionMetadataController — REST surface for per-session KV metadata.
 *
 *   GET    /api/v1/sessions/:id/meta
 *   GET    /api/v1/sessions/:id/meta/:key
 *   PUT    /api/v1/sessions/:id/meta/:key   body: { value: unknown }
 *   DELETE /api/v1/sessions/:id/meta/:key   → 204
 *
 * Auth: `Auth('admin')` for stage-1. Solution ownership enforced by the
 * service against the session's in-memory solutionId.
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
import { CurrentTenant } from '../common/decorators/current-solution.decorator';
import { SolutionAuthGuard } from '../solutions/solution-auth.guard';
import { SessionMetadataService } from './services/session-metadata.service';

interface ValueBody {
  value: unknown;
}

@ApiTags('sessions-meta')
@Controller('api/v1/sessions/:id/meta')
@UseGuards(SolutionAuthGuard)
export class SessionMetadataController {
  constructor(private readonly svc: SessionMetadataService) {}

  @Get()
  @Auth('admin')
  list(@CurrentTenant() solutionId: string, @Param('id') id: string) {
    return this.svc.list(id, solutionId);
  }

  @Get(':key')
  @Auth('admin')
  get(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
    @Param('key') key: string,
  ) {
    return this.svc.get(id, solutionId, key);
  }

  @Put(':key')
  @Auth('admin')
  put(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() body: ValueBody,
  ) {
    return this.svc.put(id, solutionId, key, body?.value);
  }

  @Delete(':key')
  @Auth('admin')
  @HttpCode(204)
  async delete(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
    @Param('key') key: string,
  ): Promise<void> {
    await this.svc.delete(id, solutionId, key);
  }
}
