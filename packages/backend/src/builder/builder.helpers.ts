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
import type { SolutionsService } from '../solutions/solutions.service';
import type { UserSolutionService } from '../users/user-solution.service';
import type { Solution } from '../solutions/entities/solution.entity';

/**
 * Extract userId from request context or throw 403.
 */
export function requireBuilderUserId(ctx: RequestContext): string {
  if (!ctx.userId) {
    throw new ForbiddenException(
      'Builder API key must be linked to a user (userId required). '
      + 'Update via PUT /api/v1/admin/api-keys/:id or use POST /api/v1/admin/builder-users.',
    );
  }
  return ctx.userId;
}

/**
 * Verify the builder user owns the tenant (has an active UserSolution record).
 * Returns the tenant entity.
 */
export async function verifyBuilderTenantOwnership(
  userId: string,
  solutionId: string,
  tenantsService: SolutionsService,
  userTenantService: UserSolutionService,
): Promise<Solution> {
  const tenant = await tenantsService.findOne(solutionId);
  if (!tenant) {
    throw new NotFoundException(`Solution not found: ${solutionId}`);
  }

  const userTenant = await userTenantService.findUserInTenant(userId, tenant.id);
  if (!userTenant || !userTenant.isActive) {
    throw new ForbiddenException('You do not have access to this tenant');
  }

  return tenant;
}
