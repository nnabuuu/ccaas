/**
 * Audit Service
 *
 * Records and queries admin actions for compliance and debugging.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  AdminAuditLog,
  AdminAction,
  TargetType,
  AuditMetadata,
} from '../entities/admin-audit-log.entity';
import { AuditLogQueryDto } from '../dto/admin.dto';

export interface LogAuditParams {
  adminId: string;
  action: AdminAction;
  targetType: TargetType;
  targetId: string;
  solutionId?: string | null;
  metadata?: AuditMetadata;
  success?: boolean;
  errorMessage?: string;
}

export interface PaginatedAuditLogs {
  items: AdminAuditLog[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly auditLogRepository: Repository<AdminAuditLog>,
  ) {}

  /**
   * Log an admin action
   */
  async log(params: LogAuditParams): Promise<AdminAuditLog> {
    const auditLog = this.auditLogRepository.create({
      adminId: params.adminId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      solutionId: params.solutionId || null,
      metadata: params.metadata || null,
      success: params.success ?? true,
      errorMessage: params.errorMessage || null,
    });

    const saved = await this.auditLogRepository.save(auditLog);
    this.logger.debug(
      `Audit log: ${params.action} on ${params.targetType}:${params.targetId} by ${params.adminId}`,
    );
    return saved;
  }

  /**
   * Log a successful action
   */
  async logSuccess(
    adminId: string,
    action: AdminAction,
    targetType: TargetType,
    targetId: string,
    metadata?: AuditMetadata,
    solutionId?: string | null,
  ): Promise<AdminAuditLog> {
    return this.log({
      adminId,
      action,
      targetType,
      targetId,
      solutionId,
      metadata,
      success: true,
    });
  }

  /**
   * Log a failed action
   */
  async logFailure(
    adminId: string,
    action: AdminAction,
    targetType: TargetType,
    targetId: string,
    errorMessage: string,
    metadata?: AuditMetadata,
    solutionId?: string | null,
  ): Promise<AdminAuditLog> {
    return this.log({
      adminId,
      action,
      targetType,
      targetId,
      solutionId,
      metadata,
      success: false,
      errorMessage,
    });
  }

  /**
   * Query audit logs with filters
   */
  async query(dto: AuditLogQueryDto): Promise<PaginatedAuditLogs> {
    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (dto.adminId) {
      qb.andWhere('log.adminId = :adminId', { adminId: dto.adminId });
    }

    if (dto.action) {
      qb.andWhere('log.action = :action', { action: dto.action });
    }

    if (dto.targetType) {
      qb.andWhere('log.targetType = :targetType', { targetType: dto.targetType });
    }

    if (dto.targetId) {
      qb.andWhere('log.targetId = :targetId', { targetId: dto.targetId });
    }

    if (dto.solutionId) {
      qb.andWhere('log.solutionId = :solutionId', { solutionId: dto.solutionId });
    }

    if (dto.success !== undefined) {
      qb.andWhere('log.success = :success', { success: dto.success });
    }

    if (dto.startDate && dto.endDate) {
      qb.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      });
    } else if (dto.startDate) {
      qb.andWhere('log.createdAt >= :startDate', {
        startDate: new Date(dto.startDate),
      });
    } else if (dto.endDate) {
      qb.andWhere('log.createdAt <= :endDate', {
        endDate: new Date(dto.endDate),
      });
    }

    const total = await qb.getCount();

    qb.take(dto.limit || 50);
    qb.skip(dto.offset || 0);

    const items = await qb.getMany();

    return {
      items,
      total,
      limit: dto.limit || 50,
      offset: dto.offset || 0,
    };
  }

  /**
   * Get audit log by ID
   */
  async findById(id: string): Promise<AdminAuditLog | null> {
    return this.auditLogRepository.findOne({ where: { id } });
  }

  /**
   * Get audit logs for a specific target
   */
  async findByTarget(
    targetType: TargetType,
    targetId: string,
    limit: number = 50,
  ): Promise<AdminAuditLog[]> {
    return this.auditLogRepository.find({
      where: { targetType, targetId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit logs for an admin
   */
  async findByAdmin(adminId: string, limit: number = 50): Promise<AdminAuditLog[]> {
    return this.auditLogRepository.find({
      where: { adminId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get recent audit logs
   */
  async getRecent(limit: number = 20): Promise<AdminAuditLog[]> {
    return this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Count actions in a time period
   */
  async countActions(
    action: AdminAction,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    return this.auditLogRepository.count({
      where: {
        action,
        createdAt: Between(startDate, endDate),
      },
    });
  }
}
