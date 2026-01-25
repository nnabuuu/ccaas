/**
 * Admin Audit Controller
 *
 * Audit log query endpoints.
 */

import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { Auth } from '../../auth/decorators';
import { AuditService, PaginatedAuditLogs } from '../services/audit.service';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { AuditLogQueryDto } from '../dto/admin.dto';

@Controller('api/v1/admin/audit')
@Auth('admin')
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
  ): Promise<PaginatedAuditLogs> {
    return this.auditService.query(query);
  }

  /**
   * GET /api/v1/admin/audit/log/:id
   *
   * Get a specific audit log entry
   */
  @Get('log/:id')
  async getAuditLog(@Param('id') id: string): Promise<AdminAuditLog> {
    const log = await this.auditService.findById(id);
    if (!log) {
      throw new NotFoundException(`Audit log not found: ${id}`);
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
  ): Promise<AdminAuditLog[]> {
    return this.auditService.findByTarget(
      'session',
      sessionId,
      limit ? parseInt(limit, 10) : 50,
    );
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
  ): Promise<AdminAuditLog[]> {
    return this.auditService.findByTarget(
      'skill',
      skillId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /**
   * GET /api/v1/admin/audit/recent
   *
   * Get recent audit logs
   */
  @Get('recent')
  async getRecentAuditLogs(
    @Query('limit') limit?: string,
  ): Promise<AdminAuditLog[]> {
    return this.auditService.getRecent(limit ? parseInt(limit, 10) : 20);
  }
}
