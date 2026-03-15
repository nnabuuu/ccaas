/**
 * Admin Bundles Controller
 *
 * Admin API for bundle management under unified /api/v1/admin path.
 * Provides endpoints to list available bundles and manage tenant bundle settings.
 */

import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  NotFoundException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { AuthAdminOrBuilder, Ctx } from '../../auth/decorators';
import { AdminTenantAccessGuard } from '../guards/admin-tenant-access.guard';
import { RequestContext } from '../../auth/types';
import { TenantsService } from '../../tenants/tenants.service';
import { BundleService } from '../../bundles/bundle.service';
import { AuditService } from '../services/audit.service';
import { EventMapperService } from '../../sessions/event-mapper.service';

@Controller('api/v1/admin')
@AuthAdminOrBuilder()
@UseGuards(AdminTenantAccessGuard)
export class AdminBundlesController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly bundleService: BundleService,
    private readonly auditService: AuditService,
    private readonly eventMapper: EventMapperService,
  ) {}

  /**
   * GET /api/v1/admin/bundles
   *
   * List all available platform bundles.
   */
  @Get('bundles')
  async listBundles() {
    return {
      bundles: this.bundleService.getAvailableBundles(),
    };
  }

  /**
   * GET /api/v1/admin/tenants/:tenantId/bundles
   *
   * Get enabled bundles for a tenant.
   */
  @Get('tenants/:tenantId/bundles')
  async getTenantBundles(@Param('tenantId') tenantId: string) {
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    const enabledBundles = tenant.config?.enabledBundles ?? [];
    const available = this.bundleService.getAvailableBundles();

    return {
      enabledBundles,
      available: available.map(b => ({
        ...b,
        enabled: enabledBundles.includes(b.id),
      })),
    };
  }

  /**
   * PATCH /api/v1/admin/tenants/:tenantId/bundles
   *
   * Update enabled bundles for a tenant.
   * Body: { enabledBundles: string[] }
   */
  @Patch('tenants/:tenantId/bundles')
  async updateTenantBundles(
    @Param('tenantId') tenantId: string,
    @Body() body: { enabledBundles: string[] },
    @Ctx() ctx: RequestContext,
  ) {
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    if (!Array.isArray(body.enabledBundles)) {
      throw new BadRequestException('enabledBundles must be an array of bundle IDs');
    }

    // Validate element types
    const invalidElements = body.enabledBundles.filter(id => typeof id !== 'string' || id.length === 0);
    if (invalidElements.length > 0) {
      throw new BadRequestException('enabledBundles must contain only non-empty string values');
    }

    // Validate all requested bundles exist
    const availableIds = new Set(
      this.bundleService.getAvailableBundles().map(b => b.id),
    );
    const invalidIds = body.enabledBundles.filter(id => !availableIds.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Unknown bundle IDs: ${invalidIds.join(', ')}. Available: ${[...availableIds].join(', ')}`,
      );
    }

    const previousBundles = tenant.config?.enabledBundles ?? [];

    // Update tenant config
    const updatedConfig = {
      ...tenant.config,
      enabledBundles: body.enabledBundles,
    };
    await this.tenantsService.update(tenant.id, { config: updatedConfig });

    // Audit log
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'tenant.update',
      targetType: 'tenant',
      targetId: tenant.id,
      tenantId: tenant.id,
      metadata: {
        previousValue: { enabledBundles: previousBundles },
        newValue: { enabledBundles: body.enabledBundles },
        reason: 'Updated tenant enabled bundles',
      },
    });

    // Re-register bundle triggers in the running EventMapperService so changes
    // take effect immediately without restarting the backend.
    // Uses separate bundle trigger storage — solution triggers are unaffected.
    const bundleResolution = this.bundleService.resolveActiveBundles(
      undefined,
      body.enabledBundles,
    );
    this.eventMapper.registerBundleTriggers(
      tenant.id,
      bundleResolution.toolEventTriggers,
    );

    return {
      enabledBundles: body.enabledBundles,
    };
  }
}
