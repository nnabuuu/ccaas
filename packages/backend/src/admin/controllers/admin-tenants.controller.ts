/**
 * Admin Tenants Controller
 *
 * Admin API for tenant management under unified /api/v1/admin path.
 */

import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthAdminOrBuilder, TenantId, Ctx } from '../../auth/decorators';
import { RequestContext } from '../../auth/types';
import { TenantsService } from '../../tenants/tenants.service';
import { UpdateTenantDto } from '../../tenants/dto/tenant.dto';
import { SkillsService } from '../../skills/skills.service';
import { AuditService } from '../services/audit.service';
import { AdminTenantAccessGuard, isAdminScope } from '../guards/admin-tenant-access.guard';
import { UserTenantService } from '../../users/user-tenant.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantQuota } from '../entities/tenant-quota.entity';

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Slug pattern (alphanumeric, hyphens, underscores)
const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]*$/i;

@Controller('api/v1/admin/tenants')
@AuthAdminOrBuilder()
@UseGuards(AdminTenantAccessGuard)
export class AdminTenantsController {
  private readonly logger = new Logger(AdminTenantsController.name);

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly skillsService: SkillsService,
    private readonly auditService: AuditService,
    private readonly userTenantService: UserTenantService,
    @InjectRepository(TenantQuota)
    private readonly tenantQuotaRepository: Repository<TenantQuota>,
  ) {}

  /**
   * GET /api/v1/admin/tenants
   *
   * List tenants. Admin sees all; builder sees only owned tenants.
   */
  @Get()
  async findAll(@Ctx() ctx: RequestContext) {
    // Admin: unrestricted
    if (isAdminScope(ctx)) {
      return this.tenantsService.findAll();
    }

    // Non-admin (builder): only tenants they own via user-tenant relationship
    if (ctx.userId) {
      const userTenants = await this.userTenantService.findByUser(ctx.userId);
      const owned = userTenants.filter((ut) => ut.tenant).map((ut) => ut.tenant);
      this.logger.debug(
        `Builder tenant list: userId=${ctx.userId} found=${owned.length} tenants`,
      );
      return owned;
    }

    // Fallback: return own tenant only (from API key)
    this.logger.warn(
      `Tenant list fallback: no userId in context, returning home tenant only`,
    );
    return ctx.tenant ? [ctx.tenant] : [];
  }

  /**
   * GET /api/v1/admin/tenants/:tenantId
   *
   * Get a tenant by ID (UUID) or slug.
   * Uses :tenantId param so AdminTenantAccessGuard can enforce builder isolation.
   */
  @Get(':tenantId')
  async findOne(@Param('tenantId') tenantId: string) {
    // Validate input format
    if (!tenantId || tenantId.length > 100) {
      throw new BadRequestException('Invalid tenant identifier');
    }

    // Must be either a valid UUID or a valid slug
    if (!UUID_REGEX.test(tenantId) && !SLUG_REGEX.test(tenantId)) {
      throw new BadRequestException('Invalid tenant identifier format');
    }

    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }
    return tenant;
  }

  /**
   * PUT /api/v1/admin/tenants/:tenantId
   *
   * Update tenant basic info (name, description, plan, status, limits, etc.)
   */
  @Put(':tenantId')
  @HttpCode(HttpStatus.OK)
  async updateTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantDto,
    @Ctx() ctx: RequestContext,
  ) {
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    const previousValue = {
      name: tenant.name,
      description: tenant.description,
      plan: tenant.plan,
      status: tenant.status,
      billingEmail: tenant.billingEmail,
      maxSessions: tenant.maxSessions,
      maxSkills: tenant.maxSkills,
      sessionTtlMs: tenant.sessionTtlMs,
    };

    const updated = await this.tenantsService.update(tenant.id, dto);

    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'tenant.update',
      targetType: 'tenant',
      targetId: tenant.id,
      tenantId: tenant.id,
      metadata: {
        previousValue,
        newValue: dto,
        reason: 'Updated tenant info via admin',
      },
    });

    return updated;
  }

  /**
   * PUT /api/v1/admin/tenants/:tenantId/skills/:skillId/toggle
   *
   * Toggle a skill's enabled/disabled state
   */
  @Put(':tenantId/skills/:skillId/toggle')
  @HttpCode(HttpStatus.OK)
  async toggleSkill(
    @Param('tenantId') tenantId: string,
    @Param('skillId') skillId: string,
    @Ctx() ctx: RequestContext,
  ) {
    // Resolve tenant
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    // Find the skill
    const skill = await this.skillsService.findOne(tenant.id, skillId);
    if (!skill) {
      throw new NotFoundException(`Skill not found: ${skillId}`);
    }

    // Toggle enabled state
    const previousEnabled = skill.enabled;
    const toggled = await this.skillsService.toggle(tenant.id, skillId);

    // Audit log
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'skill.update',
      targetType: 'skill',
      targetId: skill.id,
      tenantId: tenant.id,
      metadata: {
        previousValue: { enabled: previousEnabled },
        newValue: { enabled: toggled.enabled },
        reason: `Toggled skill enabled state from ${previousEnabled} to ${toggled.enabled}`,
      },
    });

    return {
      id: toggled.id,
      slug: toggled.slug,
      name: toggled.name,
      enabled: toggled.enabled,
    };
  }

  /**
   * GET /api/v1/admin/tenants/:tenantId/skills
   *
   * Get all skills for a tenant
   */
  @Get(':tenantId/skills')
  async getSkills(
    @Param('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    // Validate tenant exists
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    // Fetch all skills for this tenant
    const result = await this.skillsService.findAll(tenant.id, {
      page: page || 1,
      limit: limit || 100,  // Return all skills by default
    });

    // Return in format frontend expects: { skills: [...] }
    return {
      skills: result.items.map(skill => ({
        id: skill.id,
        name: skill.name,
        slug: skill.slug,
        type: skill.type,
        status: skill.status,
        enabled: skill.enabled,
      })),
    };
  }

  /**
   * PUT /api/v1/admin/tenants/:tenantId/sdk-config
   *
   * Update SDK configuration for a tenant
   */
  @Put(':tenantId/sdk-config')
  @HttpCode(HttpStatus.OK)
  async updateSdkConfig(
    @Param('tenantId') tenantId: string,
    @Body() body: { config: Record<string, unknown> },
    @Ctx() ctx: RequestContext,
  ) {
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    const previousConfig = { ...tenant.config };
    tenant.config = { ...tenant.config, ...body.config };
    const updated = await this.tenantsService.update(tenant.id, { config: tenant.config });

    // Audit log
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'tenant.update',
      targetType: 'tenant',
      targetId: tenant.id,
      tenantId: tenant.id,
      metadata: {
        previousValue: previousConfig,
        newValue: tenant.config,
        reason: 'Updated SDK configuration',
      },
    });

    return updated;
  }

  /**
   * GET /api/v1/admin/tenants/:tenantId/quotas
   *
   * Get quota information for a tenant
   */
  @Get(':tenantId/quotas')
  async getQuotas(@Param('tenantId') tenantId: string) {
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    const quotas = await this.tenantQuotaRepository.find({
      where: { tenantId: tenant.id },
      order: { createdAt: 'DESC' },
    });

    // Find monthly quota (preferred) or fallback to first quota
    const monthlyQuota = quotas.find(q => q.period === 'monthly') || quotas[0];

    if (!monthlyQuota) {
      // Return zero values if no quota exists
      return {
        tokens: { used: 0, limit: 0 },
        sessions: { used: 0, limit: 0 },
        apiCalls: { used: 0, limit: 0 },
      };
    }

    // Transform to frontend format
    return {
      tokens: {
        used: monthlyQuota.currentTokens || 0,
        limit: monthlyQuota.maxTokens || 0,
      },
      sessions: {
        used: monthlyQuota.currentSessions || 0,
        limit: monthlyQuota.maxSessions || 0,
      },
      apiCalls: {
        used: monthlyQuota.currentApiCalls || 0,
        limit: monthlyQuota.maxApiCalls || 0,
      },
    };
  }

  /**
   * PUT /api/v1/admin/tenants/:tenantId/quotas
   *
   * Create or update quotas for a tenant
   */
  @Put(':tenantId/quotas')
  @HttpCode(HttpStatus.OK)
  async updateQuotas(
    @Param('tenantId') tenantId: string,
    @Body() body: {
      period: 'monthly' | 'daily';
      maxTokens?: number;
      maxSessions?: number;
      maxApiCalls?: number;
      alertThreshold?: number;
      periodStart?: string;
      periodEnd?: string;
    },
    @Ctx() ctx: RequestContext,
  ) {
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    // Find existing quota for the period or create new
    let quota = await this.tenantQuotaRepository.findOne({
      where: { tenantId: tenant.id, period: body.period },
    });

    if (quota) {
      // Update existing
      if (body.maxTokens !== undefined) quota.maxTokens = body.maxTokens;
      if (body.maxSessions !== undefined) quota.maxSessions = body.maxSessions;
      if (body.maxApiCalls !== undefined) quota.maxApiCalls = body.maxApiCalls;
      if (body.alertThreshold !== undefined) quota.alertThreshold = body.alertThreshold;
      if (body.periodStart) quota.periodStart = new Date(body.periodStart);
      if (body.periodEnd) quota.periodEnd = new Date(body.periodEnd);
    } else {
      // Create new
      const now = new Date();
      const periodEnd = body.period === 'monthly'
        ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      quota = this.tenantQuotaRepository.create({
        tenantId: tenant.id,
        period: body.period,
        maxTokens: body.maxTokens ?? 1000000,
        maxSessions: body.maxSessions ?? 100,
        maxApiCalls: body.maxApiCalls ?? 10000,
        alertThreshold: body.alertThreshold ?? 80,
        periodStart: body.periodStart ? new Date(body.periodStart) : now,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : periodEnd,
      });
    }

    const saved = await this.tenantQuotaRepository.save(quota);

    // Audit log
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'tenant.update',
      targetType: 'tenant',
      targetId: tenant.id,
      tenantId: tenant.id,
      metadata: {
        reason: `Updated ${body.period} quotas`,
        newValue: saved,
      },
    });

    return saved;
  }
}
