/**
 * Admin Solutions Controller
 *
 * Admin API for body-based solution import and loader status.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthAdminOrBuilder, Ctx } from '../../auth/decorators';
import { AdminTenantAccessGuard } from '../guards/admin-tenant-access.guard';
import { SolutionLoaderService } from '../../solutions/solution-loader.service';
import { ImportSolutionDto } from '../dto/import-solution.dto';
import { RequestContext } from '../../auth/types';
import { TenantsService } from '../../tenants/tenants.service';
import { UserTenantService } from '../../users/user-tenant.service';

@Controller('api/v1/admin/solutions')
@AuthAdminOrBuilder()
@UseGuards(AdminTenantAccessGuard)
@ApiTags('admin')
export class AdminSolutionsController {
  private readonly logger = new Logger(AdminSolutionsController.name);

  constructor(
    private readonly loader: SolutionLoaderService,
    private readonly tenantsService: TenantsService,
    private readonly userTenantService: UserTenantService,
  ) {}

  /**
   * POST /api/v1/admin/solutions/import
   *
   * Import a solution from request body.
   * Registers tenant config (MCP servers, session templates, bundles).
   * Skills are registered separately via the Skills API.
   *
   * For builder keys: verifies the builder owns the target tenant (by slug).
   */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import solution from config body' })
  async import(@Body() dto: ImportSolutionDto, @Ctx() ctx: RequestContext) {
    // Builder tenant isolation: verify builder owns the target tenant
    if (ctx?.apiKeyScopes?.includes('builder') && !ctx.apiKeyScopes.includes('admin')) {
      await this.verifyBuilderTenantAccess(ctx, dto.tenant.slug);
    }

    return this.loader.importFromConfig(dto);
  }

  /**
   * Verify that a builder key has access to the tenant identified by slug.
   * The builder must have a userId and an active UserTenant record for the target tenant.
   */
  private async verifyBuilderTenantAccess(ctx: RequestContext, tenantSlug: string): Promise<void> {
    if (!ctx.userId) {
      throw new ForbiddenException(
        'Builder API key must be linked to a user. '
        + 'Update the key with a userId via PUT /api/v1/admin/api-keys/:id, '
        + 'or use POST /api/v1/admin/builder-users for one-step onboarding.',
      );
    }

    const tenant = await this.tenantsService.findOne(tenantSlug);
    if (!tenant) {
      // Tenant doesn't exist yet — will be created by the loader.
      // For builders, only allow creating tenants they're already linked to (via onboarding).
      // If slug matches the builder's own tenant, allow it.
      if (ctx.tenant?.slug === tenantSlug) {
        return; // Builder's own tenant slug — allowed
      }
      throw new ForbiddenException(
        `Builder cannot create new tenant "${tenantSlug}" via import. Use builder onboarding first.`,
      );
    }

    const userTenant = await this.userTenantService.findUserInTenant(ctx.userId, tenant.id);
    if (!userTenant || !userTenant.isActive) {
      throw new ForbiddenException(
        `Builder does not have access to tenant "${tenantSlug}"`,
      );
    }

    this.logger.debug(`Builder ${ctx.userId} verified for tenant ${tenantSlug}`);
  }

  /**
   * GET /api/v1/admin/solutions/status
   *
   * Get the current loader status (last load time, counts, errors).
   */
  @Get('status')
  @ApiOperation({ summary: 'Get solution loader status' })
  getStatus() {
    return this.loader.getStatus();
  }
}
