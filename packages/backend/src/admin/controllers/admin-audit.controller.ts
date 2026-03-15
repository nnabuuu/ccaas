/**
 * Admin Audit Controller
 *
 * Audit log query endpoints.
 */

import { Controller, Get, Param, Query, NotFoundException, ForbiddenException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthAdminOrBuilder, Ctx } from '../../auth/decorators';
import { RequestContext } from '../../auth/types';
import { AdminTenantAccessGuard, isAdminScope } from '../guards/admin-tenant-access.guard';
import { AuditService, PaginatedAuditLogs } from '../services/audit.service';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { AuditLogQueryDto } from '../dto/admin.dto';

@ApiTags('admin')
@Controller('api/v1/admin/audit')
@AuthAdminOrBuilder()
@UseGuards(AdminTenantAccessGuard)
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /api/v1/admin/audit/log
   *
   * Query audit logs with filtering and pagination
   */
  @Get('log')
  async queryAuditLogs(
    @Query() query: AuditLogQueryDto,
    @Ctx() ctx: RequestContext,
  ): Promise<PaginatedAuditLogs> {
    if (!isAdminScope(ctx)) query.tenantId = ctx.tenantId;
    return this.auditService.query(query);
  }

  /**
   * GET /api/v1/admin/audit/log/:id
   *
   * Get a specific audit log entry
   */
  @Get('log/:id')
  async getAuditLog(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ): Promise<AdminAuditLog> {
    const log = await this.auditService.findById(id);
    if (!log) {
      throw new NotFoundException(`Audit log not found: ${id}`);
    }
    // Builder keys: verify tenant ownership on fetched resource
    if (!isAdminScope(ctx) && log.tenantId && log.tenantId !== ctx.tenantId) {
      throw new ForbiddenException('Access denied to this audit log entry');
    }
    return log;
  }

  /**
   * GET /api/v1/admin/audit/sessions/:sessionId
   *
   * Get all audit logs for a specific session
   */
  @Get('sessions/:sessionId')
  async getSessionAudit(
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string,
    @Ctx() ctx?: RequestContext,
  ): Promise<AdminAuditLog[]> {
    const logs = await this.auditService.findByTarget(
      'session',
      sessionId,
      limit ? parseInt(limit, 10) : 50,
    );
    // Builder keys: filter to own tenant only
    if (ctx && !isAdminScope(ctx)) {
      return logs.filter((l) => !l.tenantId || l.tenantId === ctx.tenantId);
    }
    return logs;
  }

  /**
   * GET /api/v1/admin/audit/skills/:skillId
   *
   * Get all audit logs for a specific skill
   */
  @Get('skills/:skillId')
  async getSkillAudit(
    @Param('skillId') skillId: string,
    @Query('limit') limit?: string,
    @Ctx() ctx?: RequestContext,
  ): Promise<AdminAuditLog[]> {
    const logs = await this.auditService.findByTarget(
      'skill',
      skillId,
      limit ? parseInt(limit, 10) : 50,
    );
    // Builder keys: filter to own tenant only
    if (ctx && !isAdminScope(ctx)) {
      return logs.filter((l) => !l.tenantId || l.tenantId === ctx.tenantId);
    }
    return logs;
  }

  /**
   * GET /api/v1/admin/audit/recent
   *
   * Get recent audit logs
   */
  @Get('recent')
  async getRecentAuditLogs(
    @Query('limit') limit?: string,
    @Ctx() ctx?: RequestContext,
  ): Promise<AdminAuditLog[]> {
    const logs = await this.auditService.getRecent(limit ? parseInt(limit, 10) : 20);
    // Builder keys: filter to own tenant only
    if (ctx && !isAdminScope(ctx)) {
      return logs.filter((l) => !l.tenantId || l.tenantId === ctx.tenantId);
    }
    return logs;
  }
}
