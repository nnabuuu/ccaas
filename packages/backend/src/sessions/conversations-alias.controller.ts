/**
 * Conversations Alias Controller
 *
 * Backward-compatible alias that forwards /api/v1/conversations to SessionsController.
 * "Conversation" and "Session" are the same entity — see ADR-0007.
 *
 * TODO: Remove in next major version after all clients migrate to /sessions.
 */

import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SessionsController } from './sessions.controller';
import { OptionalAuth, Auth, Ctx } from '../auth/decorators';
import { TenantGuard } from '../tenants/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { RequestContext } from '../auth/types';
import {
  ListConversationsQuery,
  SearchConversationsQuery,
  UpdateConversationDto,
} from './dto/session-query.dto';

@ApiTags('conversations (alias)')
@Controller('api/v1/conversations')
export class ConversationsAliasController {
  constructor(private readonly sessionsController: SessionsController) {}

  @Get()
  @UseGuards(TenantGuard)
  @OptionalAuth()
  @ApiOperation({ summary: '[Alias] → GET /api/v1/sessions' })
  listConversations(
    @Query() query: ListConversationsQuery,
    @CurrentTenant() tenantId: string | undefined,
  ) {
    return this.sessionsController.listSessions(query, tenantId);
  }

  @Get('search')
  @UseGuards(TenantGuard)
  @OptionalAuth()
  @ApiOperation({ summary: '[Alias] → GET /api/v1/sessions/search' })
  searchConversations(
    @Query() query: SearchConversationsQuery,
    @CurrentTenant() tenantId: string | undefined,
  ) {
    return this.sessionsController.searchSessions(query, tenantId);
  }

  @Patch(':id')
  @UseGuards(TenantGuard)
  @Auth('chat')
  @ApiOperation({ summary: '[Alias] → PATCH /api/v1/sessions/:id' })
  updateConversation(
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.sessionsController.updateSession(id, dto, ctx);
  }

  @Delete(':id')
  @UseGuards(TenantGuard)
  @Auth('chat')
  @ApiOperation({ summary: '[Alias] → DELETE /api/v1/sessions/:id' })
  deleteConversation(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ) {
    return this.sessionsController.deleteSession(id, ctx);
  }

  @Get(':id/turns')
  @UseGuards(TenantGuard)
  @OptionalAuth()
  @ApiOperation({ summary: '[Alias] → GET /api/v1/sessions/:id/turns' })
  getConversationTurns(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string | undefined,
  ) {
    return this.sessionsController.getSessionTurns(id, tenantId);
  }
}
