/**
 * User Sessions Controller
 *
 * User-scoped API for listing session history.
 * Unlike the admin SessionManagerService, this endpoint does not require admin scope.
 * It filters sessions by userId + tenantId.
 */

import {
  Controller,
  Get,
  Query,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auth, Ctx } from '../auth/decorators';
import { RequestContext } from '../auth/types';
import { Session } from '../admin/entities/session.entity';

interface UserSessionListItem {
  sessionId: string;
  title: string | null;
  lastActivity: Date;
  messageCount: number;
  isPinned: boolean;
  status: string;
  createdAt: Date;
}

interface PaginatedUserSessions {
  data: UserSessionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

@Auth('chat')
@ApiTags('sessions')
@Controller('api/v1/user-sessions')
export class UserSessionsController {
  private readonly logger = new Logger(UserSessionsController.name);

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取用户会话列表 / List user sessions' })
  @ApiQuery({ name: 'userId', required: true, description: '用户 ID' })
  @ApiQuery({ name: 'tenantId', required: true, description: '租户 ID' })
  @ApiQuery({ name: 'page', required: false, description: '页码（默认 1）' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量（默认 30，最大 100）' })
  @ApiResponse({ status: 200, description: '返回分页的会话列表' })
  async listUserSessions(
    @Query('userId') userId: string,
    @Query('tenantId') tenantId: string,
    @Ctx() ctx: RequestContext,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ): Promise<PaginatedUserSessions> {
    // Non-admin keys: enforce tenant isolation and user ownership
    if (!ctx?.apiKeyScopes?.includes('admin')) {
      if (!ctx?.userId) {
        throw new ForbiddenException('API key must be bound to a user to access user sessions');
      }
      if (ctx.userId !== userId) {
        throw new ForbiddenException('Cannot access sessions of another user');
      }
      if (ctx.tenantId !== tenantId) {
        throw new ForbiddenException('Cannot access sessions of another tenant');
      }
    }

    const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(pageSizeStr || '30', 10) || 30));
    const offset = (page - 1) * pageSize;

    const qb = this.sessionRepository.createQueryBuilder('session');

    qb.where('session.userId = :userId', { userId });
    qb.andWhere('session.tenantId = :tenantId', { tenantId });

    const total = await qb.getCount();

    const sessions = await qb
      .orderBy('session.lastActivity', 'DESC')
      .skip(offset)
      .take(pageSize)
      .getMany();

    const data: UserSessionListItem[] = sessions.map((s) => ({
      sessionId: s.sessionId,
      title: s.title,
      lastActivity: s.lastActivity,
      messageCount: s.messageCount,
      isPinned: s.isPinned,
      status: s.status,
      createdAt: s.createdAt,
    }));

    return { data, total, page, pageSize };
  }
}
