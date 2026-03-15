/**
 * Admin Builder Users Controller
 *
 * One-step builder user onboarding: creates user, tenant, user-tenant link, and builder API key.
 * NOTE: The operation is NOT transactional — each service uses its own repository.
 * If a mid-flow step fails, earlier entities may persist. The caller receives the error
 * and can use individual admin APIs to clean up or retry.
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth, Ctx } from '../../auth/decorators';
import { RequestContext } from '../../auth/types';
import { UsersService } from '../../users/users.service';
import { UserTenantService } from '../../users/user-tenant.service';
import { TenantsService } from '../../tenants/tenants.service';
import { ApiKeyService } from '../../auth/api-key.service';
import { AuditService } from '../services/audit.service';
import { CreateBuilderUserDto } from '../dto/create-builder-user.dto';

@ApiTags('admin')
@Controller('api/v1/admin/builder-users')
@Auth('admin')
export class AdminBuilderUsersController {
  private readonly logger = new Logger(AdminBuilderUsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly userTenantService: UserTenantService,
    private readonly apiKeyService: ApiKeyService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * POST /api/v1/admin/builder-users
   *
   * Create a builder user with tenant, user-tenant link, and builder API key.
   * Steps execute sequentially — if any step fails, subsequent steps are skipped.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateBuilderUserDto,
    @Ctx() ctx: RequestContext,
  ) {
    // 1. Create user (throws 409 if email exists)
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
    });

    // 2. Create tenant (throws 409 if slug conflicts)
    const tenantResult = await this.tenantsService.create({
      name: dto.tenantName,
      slug: dto.tenantSlug,
    });
    const tenant = tenantResult.tenant;

    // 3. Link user to tenant as admin
    await this.userTenantService.create({
      userId: user.id,
      tenantId: tenant.id,
      role: 'admin',
    });

    // 4. Create builder API key
    const apiKeyResult = await this.apiKeyService.create(tenant.id, {
      name: `Builder Key for ${dto.name}`,
      scopes: ['builder'],
      userId: user.id,
    });

    // 5. Audit log
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'builderUser.create',
      targetType: 'user',
      targetId: user.id,
      tenantId: tenant.id,
      metadata: {
        name: dto.name,
        tenantSlug: tenant.slug,
        apiKeyPrefix: apiKeyResult.apiKey.keyPrefix,
      },
    });

    this.logger.log(
      `Builder user onboarded: ${dto.email} → tenant ${tenant.slug}`,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      apiKey: {
        id: apiKeyResult.apiKey.id,
        name: apiKeyResult.apiKey.name,
        keyPrefix: apiKeyResult.apiKey.keyPrefix,
        scopes: apiKeyResult.apiKey.scopes,
      },
      rawKey: apiKeyResult.rawKey,
      warning:
        'This is the only time the raw API key will be displayed. Please save it securely.',
    };
  }
}
