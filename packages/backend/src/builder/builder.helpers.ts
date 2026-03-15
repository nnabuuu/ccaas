/**
 * Builder Helpers
 *
 * Shared helper functions for builder controllers.
 */

import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { RequestContext } from '../auth/types';
import type { TenantsService } from '../tenants/tenants.service';
import type { UserTenantService } from '../users/user-tenant.service';
import type { Tenant } from '../tenants/entities/tenant.entity';

/**
 * Extract userId from request context or throw 403.
 */
export function requireBuilderUserId(ctx: RequestContext): string {
  if (!ctx.userId) {
    throw new ForbiddenException(
      'Builder API key must be linked to a user (userId required)',
    );
  }
  return ctx.userId;
}

/**
 * Verify the builder user owns the tenant (has an active UserTenant record).
 * Returns the tenant entity.
 */
export async function verifyBuilderTenantOwnership(
  userId: string,
  tenantId: string,
  tenantsService: TenantsService,
  userTenantService: UserTenantService,
): Promise<Tenant> {
  const tenant = await tenantsService.findOne(tenantId);
  if (!tenant) {
    throw new NotFoundException(`Tenant not found: ${tenantId}`);
  }

  const userTenant = await userTenantService.findUserInTenant(userId, tenant.id);
  if (!userTenant || !userTenant.isActive) {
    throw new ForbiddenException('You do not have access to this tenant');
  }

  return tenant;
}
