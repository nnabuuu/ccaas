/**
 * Admin Users Controller
 *
 * Admin API for tenant user management under unified /api/v1/admin path.
 * Creates users with tenant association and auto-generates chat API keys.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthAdminOrBuilder, Ctx } from '../../auth/decorators';
import { AdminTenantAccessGuard, isAdminScope } from '../guards/admin-tenant-access.guard';
import { RequestContext } from '../../auth/types';
import { UsersService } from '../../users/users.service';
import { UserTenantService } from '../../users/user-tenant.service';
import { TenantsService } from '../../tenants/tenants.service';
import { ApiKeyService } from '../../auth/api-key.service';
import { AuditService } from '../services/audit.service';
import { CreateTenantUserDto } from '../dto/create-tenant-user.dto';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import type { UserRole } from '../../users/entities/user-tenant.entity';
import type { UserTenantFilter } from '../../users/user-tenant.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('admin')
@Controller('api/v1/admin/users')
@AuthAdminOrBuilder()
@UseGuards(AdminTenantAccessGuard)
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly userTenantService: UserTenantService,
    private readonly tenantsService: TenantsService,
    private readonly apiKeyService: ApiKeyService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /api/v1/admin/users
   *
   * List users for a tenant with pagination.
   * Builder keys: auto-scoped to own tenant.
   */
  @Get()
  async findAll(
    @Query('tenantId') tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search: string | undefined,
    @Query('role') role: string | undefined,
    @Query('status') status: string | undefined,
    @Ctx() ctx: RequestContext,
  ) {
    // Builder scope isolation: force tenantId to own tenant
    if (!isAdminScope(ctx)) {
      tenantId = ctx.tenantId;
    }

    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required');
    }

    // Validate tenant exists
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    // Build filter
    const filter: UserTenantFilter = {};
    if (search) filter.search = search.slice(0, 200);
    if (role && ['admin', 'developer', 'viewer'].includes(role)) {
      filter.role = role as UserRole;
    }
    if (status && ['active', 'suspended', 'deleted'].includes(status)) {
      filter.status = status;
    }

    // Get total count and paginated results from DB
    const skip = (pageNum - 1) * limitNum;
    const [total, userTenants] = await Promise.all([
      this.userTenantService.countByTenant(tenantId, filter),
      this.userTenantService.findByTenant(tenantId, { skip, take: limitNum, filter }),
    ]);

    const items = userTenants.map((ut) => ({
      id: ut.user.id,
      email: ut.user.email,
      name: ut.user.name,
      status: ut.user.status,
      role: ut.role,
      canCreateSkills: ut.canCreateSkills,
      isActive: ut.isActive,
      userTenantId: ut.id,
      joinedAt: ut.joinedAt,
      createdAt: ut.user.createdAt,
    }));

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  /**
   * POST /api/v1/admin/users
   *
   * Create a user + tenant association + chat API key.
   * Returns raw key only in this response.
   *
   * NOTE: The operation is NOT transactional — each service uses its own repository.
   * If a mid-flow step fails, earlier entities may persist. The caller receives the error
   * and can use individual admin APIs to clean up or retry.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateTenantUserDto,
    @Ctx() ctx: RequestContext,
  ) {
    // Builder scope isolation
    if (!isAdminScope(ctx)) {
      dto.tenantId = ctx.tenantId;
    }

    // Validate tenant exists
    const tenant = await this.tenantsService.findOne(dto.tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${dto.tenantId}`);
    }

    const role = dto.role || 'viewer';

    // 1. Create user (throws 409 if email exists)
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
    });

    // 2. Link user to tenant
    const userTenant = await this.userTenantService.create({
      userId: user.id,
      tenantId: tenant.id,
      role,
    });

    // 3. Create chat API key
    const apiKeyResult = await this.apiKeyService.create(tenant.id, {
      name: `Chat key for ${dto.name}`,
      scopes: ['chat'],
      userId: user.id,
    });

    // 4. Audit log
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'user.create',
      targetType: 'user',
      targetId: user.id,
      tenantId: tenant.id,
      metadata: {
        email: dto.email,
        name: dto.name,
        role,
        apiKeyPrefix: apiKeyResult.apiKey.keyPrefix,
      },
    });

    this.logger.log(
      `Tenant user created: ${dto.email} → tenant ${tenant.slug} (role: ${role})`,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
      },
      userTenant: {
        id: userTenant.id,
        role: userTenant.role,
        canCreateSkills: userTenant.canCreateSkills,
      },
      apiKey: {
        id: apiKeyResult.apiKey.id,
        keyPrefix: apiKeyResult.apiKey.keyPrefix,
        scopes: apiKeyResult.apiKey.scopes,
      },
      rawKey: apiKeyResult.rawKey,
      warning:
        'This is the only time the raw API key will be displayed. Please save it securely.',
    };
  }

  /**
   * GET /api/v1/admin/users/:id
   *
   * Get a user with tenant associations.
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const user = await this.usersService.findOne(id);

    // Builder scope: verify user belongs to builder's tenant
    if (!isAdminScope(ctx)) {
      const belongsToTenant = user.tenants?.some(
        (ut) => ut.tenantId === ctx.tenantId && ut.isActive,
      );
      if (!belongsToTenant) {
        throw new ForbiddenException('Access denied to this user');
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      tenants: user.tenants?.map((ut) => ({
        id: ut.id,
        tenantId: ut.tenantId,
        tenantName: ut.tenant?.name,
        role: ut.role,
        canCreateSkills: ut.canCreateSkills,
        isActive: ut.isActive,
        joinedAt: ut.joinedAt,
      })),
    };
  }

  /**
   * PATCH /api/v1/admin/users/:id
   *
   * Update user name or status.
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Ctx() ctx: RequestContext,
  ) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid user ID format');
    }

    // Verify user exists and check access
    const existing = await this.usersService.findOne(id);

    if (!isAdminScope(ctx)) {
      const belongsToTenant = existing.tenants?.some(
        (ut) => ut.tenantId === ctx.tenantId && ut.isActive,
      );
      if (!belongsToTenant) {
        throw new ForbiddenException('Access denied to this user');
      }
    }

    const updated = await this.usersService.update(id, dto);

    // Derive tenantId from user's tenant association (not the admin key's tenant)
    const userTenantId = existing.tenants?.find((ut) => ut.isActive)?.tenantId || ctx.tenantId;

    // Audit log
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'user.update',
      targetType: 'user',
      targetId: id,
      tenantId: userTenantId,
      metadata: {
        previousValue: { name: existing.name, status: existing.status },
        newValue: { name: updated.name, status: updated.status },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * PATCH /api/v1/admin/users/:id/role
   *
   * Update a user's role and permissions within their tenant.
   */
  @Patch(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @Ctx() ctx: RequestContext,
  ) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid user ID format');
    }

    // Verify user exists and check access
    const existing = await this.usersService.findOne(id);

    if (!isAdminScope(ctx)) {
      const belongsToTenant = existing.tenants?.some(
        (ut) => ut.tenantId === ctx.tenantId && ut.isActive,
      );
      if (!belongsToTenant) {
        throw new ForbiddenException('Access denied to this user');
      }
    }

    // Find the user-tenant association for the relevant tenant
    const targetTenantId = isAdminScope(ctx)
      ? existing.tenants?.find((ut) => ut.isActive)?.tenantId || ctx.tenantId
      : ctx.tenantId;

    const userTenant = await this.userTenantService.findUserInTenant(id, targetTenantId);
    if (!userTenant) {
      throw new NotFoundException('User is not a member of this tenant');
    }

    const previousRole = userTenant.role;
    const previousCanCreate = userTenant.canCreateSkills;

    const updated = await this.userTenantService.update(userTenant.id, {
      role: dto.role,
      canCreateSkills: dto.canCreateSkills,
    });

    // Audit log
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'user.role_update',
      targetType: 'user',
      targetId: id,
      tenantId: targetTenantId,
      metadata: {
        previousValue: { role: previousRole, canCreateSkills: previousCanCreate },
        newValue: { role: updated.role, canCreateSkills: updated.canCreateSkills },
      },
    });

    return {
      id: existing.id,
      role: updated.role,
      canCreateSkills: updated.canCreateSkills,
      userTenantId: updated.id,
    };
  }

  /**
   * DELETE /api/v1/admin/users/:id
   *
   * Soft delete user (set status to 'deleted') and revoke associated API keys.
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid user ID format');
    }

    // Verify user exists and check access
    const existing = await this.usersService.findOne(id);

    if (!isAdminScope(ctx)) {
      const belongsToTenant = existing.tenants?.some(
        (ut) => ut.tenantId === ctx.tenantId && ut.isActive,
      );
      if (!belongsToTenant) {
        throw new ForbiddenException('Access denied to this user');
      }
    }

    // Derive tenantId from user's tenant association (not the admin key's tenant)
    const userTenantId = existing.tenants?.find((ut) => ut.isActive)?.tenantId || ctx.tenantId;

    // Audit log BEFORE deletion
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'user.delete',
      targetType: 'user',
      targetId: id,
      tenantId: userTenantId,
      metadata: {
        email: existing.email,
        name: existing.name,
      },
    });

    // Soft delete user
    await this.usersService.remove(id);

    // Revoke all API keys for deleted user
    await this.apiKeyService.revokeByUserId(id);

    // Deactivate tenant associations
    if (existing.tenants) {
      for (const ut of existing.tenants) {
        if (ut.isActive) {
          await this.userTenantService.remove(ut.id);
        }
      }
    }

    this.logger.log(`User deleted: ${existing.email} (${id})`);

    return {
      success: true,
      message: `User ${existing.email} deleted successfully`,
    };
  }
}
