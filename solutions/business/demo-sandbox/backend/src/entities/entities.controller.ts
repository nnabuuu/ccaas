/**
 * EntitiesController — REST surface for the agent-facing edit API.
 *
 * GET  /api/demo-sandbox/entities             → list entity ids
 * GET  /api/demo-sandbox/entities/:id         → serialized markdown
 * PUT  /api/demo-sandbox/entities/:id         → apply EditOperation[]
 *
 * No auth: this is a local demo backend, sandboxed bash makes the
 * security boundary the host network, not HTTP-level. (Don't ship this
 * shape to multi-tenant prod.)
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DemoEntityProvider } from './demo-entity.provider';

interface EditRequest {
  ops?: Array<
    | { op: 'str_replace'; old_string: string; new_string: string }
    | { op: 'field_set'; field: string; value: string | number | boolean }
  >;
}

@Controller('api/demo-sandbox/entities')
export class EntitiesController {
  private readonly logger = new Logger(EntitiesController.name);

  constructor(private readonly provider: DemoEntityProvider) {}

  @Get()
  list(): { ids: string[] } {
    return { ids: this.provider.listIds() };
  }

  @Get(':id')
  async serialize(@Param('id') id: string): Promise<{ id: string; content: string }> {
    try {
      const content = await this.provider.serialize(id, 'demo-user');
      return { id, content };
    } catch (err) {
      throw new NotFoundException(`Entity not found or serialize failed: ${id}`);
    }
  }

  @Put(':id')
  async edit(@Param('id') id: string, @Body() body: EditRequest) {
    if (!body?.ops?.length) {
      throw new BadRequestException('Request body must contain a non-empty `ops` array');
    }
    const result = await this.provider.edit(id, body.ops as any, 'demo-user');
    if (!result.success) {
      this.logger.warn(`Edit ${id} failed: ${result.error}`);
      throw new BadRequestException(result.error);
    }
    return { id, success: true, document: result.document };
  }
}
