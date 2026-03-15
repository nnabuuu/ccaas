/**
 * Builder Tenants Controller
 *
 * Allows builder-scoped API keys to create and manage their own tenants.
 * All operations are scoped to tenants linked to the builder's user via UserTenant.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth, Ctx } from '../auth/decorators';
import { RequestContext } from '../auth/types';
import { TenantsService } from '../tenants/tenants.service';
import { UserTenantService } from '../users/user-tenant.service';
import { AuditService } from '../admin/services/audit.service';
import { CreateTenantDto, UpdateTenantDto } from '../tenants/dto/tenant.dto';
import type { Tenant } from '../tenants/entities/tenant.entity';
import { requireBuilderUserId, verifyBuilderTenantOwnership } from './builder.helpers';

@ApiTags('builder')
@Controller('api/v1/builder/tenants')
@Auth('builder')
export class BuilderTenantsController {
  private readonly logger = new Logger(BuilderTenantsController.name);

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly userTenantService: UserTenantService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * POST /api/v1/builder/tenants
   *
   * Create a tenant and auto-link the builder as admin via UserTenant.
   */
  @Post()
  async create(
    @Body() dto: CreateTenantDto,
    @Ctx() ctx: RequestContext,
  ) {
    const userId = requireBuilderUserId(ctx);

    const result = await this.tenantsService.create(dto);

    // Auto-link builder user as admin of the new tenant
    await this.userTenantService.create({
      userId,
      tenantId: result.tenant.id,
      role: 'admin',
    });

    this.logger.log(
      `Builder ${userId} created tenant ${result.tenant.slug} and auto-linked as admin`,
    );

    await this.auditService.log({
      adminId: ctx.apiKeyId || userId,
      action: 'tenant.create',
      targetType: 'tenant',
      targetId: result.tenant.id,
      tenantId: result.tenant.id,
      metadata: {
        name: dto.name,
        slug: result.tenant.slug,
        builderUserId: userId,
      },
    });

    return result;
  }

  /**
   * GET /api/v1/builder/tenants
   *
   * List tenants owned by the builder (filtered by UserTenant).
   */
  @Get()
  async findAll(@Ctx() ctx: RequestContext): Promise<Tenant[]> {
    const userId = requireBuilderUserId(ctx);

    const userTenants = await this.userTenantService.findByUser(userId);
    const tenants: Tenant[] = [];

    for (const ut of userTenants) {
      if (ut.tenant && ut.tenant.status === 'active') {
        tenants.push(ut.tenant);
      }
    }

    return tenants;
  }

  /**
   * GET /api/v1/builder/tenants/:id
   *
   * Get a tenant owned by the builder.
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ): Promise<Tenant> {
    const userId = requireBuilderUserId(ctx);
    return verifyBuilderTenantOwnership(userId, id, this.tenantsService, this.userTenantService);
  }

  /**
   * PUT /api/v1/builder/tenants/:id
   *
   * Update a tenant owned by the builder.
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @Ctx() ctx: RequestContext,
  ): Promise<Tenant> {
    const userId = requireBuilderUserId(ctx);
    await verifyBuilderTenantOwnership(userId, id, this.tenantsService, this.userTenantService);

    const updated = await this.tenantsService.update(id, dto);

    await this.auditService.log({
      adminId: ctx.apiKeyId || userId,
      action: 'tenant.update',
      targetType: 'tenant',
      targetId: id,
      tenantId: id,
      metadata: {
        builderUserId: userId,
        changes: dto,
      },
    });

    return updated;
  }
}
