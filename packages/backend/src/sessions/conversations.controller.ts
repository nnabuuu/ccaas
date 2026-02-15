/**
 * Conversations Controller
 *
 * REST API for conversation metadata management (list, search, update, delete).
 * Distinct from SessionsController (runtime operations) and MessagesController (message queries).
 *
 * Boundary:
 * - SessionsController: Runtime ops (completion, cancel, workspace)
 * - ConversationsController: Metadata management (list, search, update title, pin)
 * - MessagesController: Message queries (existing, no changes)
 */

import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsNotEmpty,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Auth, Ctx } from '../auth/decorators';
import { RequestContext } from '../auth/types';
import { Session } from '../admin/entities/session.entity';
import { TurnsService } from '../admin/services/turns.service';
import { Turn } from '../admin/entities/turn.entity';

// ===========================================================================
// DTOs
// ===========================================================================

export class ListConversationsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPinned?: boolean;
}

export class SearchConversationsQuery {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  q!: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export interface ConversationListResponse {
  conversations: Session[];
  total: number;
  hasMore: boolean;
}

// ===========================================================================
// Controller
// ===========================================================================

@Controller('api/v1/conversations')
@Auth('chat')
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly turnsService: TurnsService,
  ) {}

  /**
   * GET /api/v1/conversations
   *
   * List conversations with pagination and optional filters.
   */
  @Get()
  async listConversations(
    @Query() query: ListConversationsQuery,
    @Ctx() ctx: RequestContext,
  ): Promise<ConversationListResponse> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const qb = this.sessionRepository.createQueryBuilder('session');

    // Tenant isolation
    qb.andWhere('session.tenantId = :tenantId', { tenantId: ctx.tenantId });

    // Exclude soft-deleted conversations
    qb.andWhere('session.status != :closed', { closed: 'closed' });

    // Optional filters
    if (query.isPinned !== undefined) {
      qb.andWhere('session.isPinned = :isPinned', { isPinned: query.isPinned });
    }

    const total = await qb.getCount();

    const conversations = await qb
      .orderBy('session.lastActivity', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    const hasMore = offset + conversations.length < total;

    return { conversations, total, hasMore };
  }

  /**
   * GET /api/v1/conversations/search
   *
   * Search conversations by title.
   */
  @Get('search')
  async searchConversations(
    @Query() query: SearchConversationsQuery,
    @Ctx() ctx: RequestContext,
  ): Promise<Session[]> {
    const qb = this.sessionRepository.createQueryBuilder('session');

    // Tenant isolation
    qb.andWhere('session.tenantId = :tenantId', { tenantId: ctx.tenantId });

    // Exclude soft-deleted conversations
    qb.andWhere('session.status != :closed', { closed: 'closed' });

    // Title search
    if (query.q) {
      qb.andWhere('session.title LIKE :query', { query: `%${query.q}%` });
    }

    // Date range filters
    if (query.dateFrom) {
      qb.andWhere('session.createdAt >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }

    if (query.dateTo) {
      qb.andWhere('session.createdAt <= :dateTo', {
        dateTo: new Date(query.dateTo),
      });
    }

    return qb
      .orderBy('session.lastActivity', 'DESC')
      .take(50)
      .getMany();
  }

  /**
   * PATCH /api/v1/conversations/:id
   *
   * Update conversation metadata (title, isPinned).
   */
  @Patch(':id')
  async updateConversation(
    @Param('id') sessionId: string,
    @Body() dto: UpdateConversationDto,
    @Ctx() ctx: RequestContext,
  ): Promise<Session> {
    const session = await this.sessionRepository.findOne({
      where: { sessionId, tenantId: ctx.tenantId },
    });

    if (!session) {
      throw new NotFoundException(`Conversation not found: ${sessionId}`);
    }

    if (dto.title !== undefined) {
      session.title = dto.title;
    }

    if (dto.isPinned !== undefined) {
      session.isPinned = dto.isPinned;
    }

    return this.sessionRepository.save(session);
  }

  /**
   * DELETE /api/v1/conversations/:id
   *
   * Soft delete a conversation (sets closedAt, preserves data).
   */
  @Delete(':id')
  async deleteConversation(
    @Param('id') sessionId: string,
    @Ctx() ctx: RequestContext,
  ): Promise<{ success: boolean }> {
    const session = await this.sessionRepository.findOne({
      where: { sessionId, tenantId: ctx.tenantId },
    });

    if (!session) {
      throw new NotFoundException(`Conversation not found: ${sessionId}`);
    }

    session.closedAt = new Date();
    session.status = 'closed';
    await this.sessionRepository.save(session);

    return { success: true };
  }

  /**
   * GET /api/v1/conversations/:id/turns
   *
   * Get all turns for a conversation (for analytics).
   */
  @Get(':id/turns')
  async getConversationTurns(
    @Param('id') sessionId: string,
    @Ctx() ctx: RequestContext,
  ): Promise<Turn[]> {
    // Verify session belongs to tenant
    const session = await this.sessionRepository.findOne({
      where: { sessionId, tenantId: ctx.tenantId },
    });

    if (!session) {
      throw new NotFoundException(`Conversation not found: ${sessionId}`);
    }

    // Get all turns for this session
    return this.turnsService.getTurnsBySession(sessionId);
  }
}
