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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiProperty,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    description: 'Filter by pinned status',
    required: false,
    type: Boolean,
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPinned?: boolean;
}

export class SearchConversationsQuery {
  @ApiProperty({
    description: 'Search query to match against conversation titles',
    required: true,
    maxLength: 255,
    example: 'Python debugging',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  q!: string;

  @ApiProperty({
    description: 'Filter conversations created after this date (ISO 8601)',
    required: false,
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiProperty({
    description: 'Filter conversations created before this date (ISO 8601)',
    required: false,
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class UpdateConversationDto {
  @ApiProperty({
    description: 'New title for the conversation',
    required: false,
    maxLength: 255,
    example: 'Python Debugging Session',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({
    description: 'Pin or unpin this conversation',
    required: false,
    type: Boolean,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class ConversationListResponse {
  @ApiProperty({
    description: 'Array of conversation sessions',
    type: [Session],
  })
  conversations: Session[];

  @ApiProperty({
    description: 'Total number of conversations matching filters',
    example: 42,
  })
  total: number;

  @ApiProperty({
    description: 'Whether there are more conversations beyond the current page',
    example: true,
  })
  hasMore: boolean;
}

// ===========================================================================
// Controller
// ===========================================================================

@Controller('api/v1/conversations')
@Auth('chat')
@ApiTags('conversations')
@ApiBearerAuth()
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
  @ApiOperation({
    summary: 'List conversations with pagination',
    description:
      'Retrieve a paginated list of conversations for the authenticated tenant. ' +
      'Supports filtering by pinned status and excludes soft-deleted conversations.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'isPinned', required: false, type: Boolean, description: 'Filter by pinned status' })
  @ApiResponse({
    status: 200,
    description: 'Conversation list retrieved successfully',
    type: ConversationListResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing API key',
  })
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
  @ApiOperation({
    summary: 'Search conversations by title',
    description:
      'Search conversations using a text query matched against conversation titles. ' +
      'Supports optional date range filtering. Returns up to 50 results ordered by last activity.',
  })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query for conversation titles' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Filter by creation date (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'Filter by creation date (ISO 8601)' })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    type: [Session],
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid search query or date format',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing API key',
  })
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
  @ApiOperation({
    summary: 'Update conversation metadata',
    description:
      'Update the title and/or pinned status of a conversation. ' +
      'Only conversations belonging to the authenticated tenant can be updated.',
  })
  @ApiParam({ name: 'id', description: 'Conversation session ID', example: 'conv_abc123' })
  @ApiResponse({
    status: 200,
    description: 'Conversation updated successfully',
    type: Session,
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found or does not belong to this tenant',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing API key',
  })
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
  @ApiOperation({
    summary: 'Soft delete a conversation',
    description:
      'Soft delete a conversation by setting its closedAt timestamp and status to "closed". ' +
      'The conversation data is preserved in the database and can be recovered if needed.',
  })
  @ApiParam({ name: 'id', description: 'Conversation session ID', example: 'conv_abc123' })
  @ApiResponse({
    status: 200,
    description: 'Conversation deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found or does not belong to this tenant',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing API key',
  })
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
  @ApiOperation({
    summary: 'Get conversation turns for analytics',
    description:
      'Retrieve all turns (user-assistant exchanges) for a conversation, including token usage and duration metrics. ' +
      'Useful for analytics dashboards showing per-turn cost and performance.',
  })
  @ApiParam({ name: 'id', description: 'Conversation session ID', example: 'conv_abc123' })
  @ApiResponse({
    status: 200,
    description: 'Turns retrieved successfully',
    type: [Turn],
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found or does not belong to this tenant',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing API key',
  })
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
