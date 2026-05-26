/**
 * Solution Guard
 *
 * Validates and extracts tenant from requests.
 * Supports API key authentication and X-Solution-Id header.
 *
 * Sets request.solutionId and request.tenant as the operation target.
 * request.context (caller identity set by ApiKeyGuard) is NEVER modified.
 * Admin API keys may cross-tenant operate via X-Solution-Id header.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { SolutionsService } from './solutions.service';
import { UserSolutionService } from '../users/user-solution.service';
import type { RequestContext } from '../auth/types';

@Injectable()
export class SolutionAuthGuard implements CanActivate {
  private readonly logger = new Logger(SolutionAuthGuard.name);

  constructor(
    private readonly tenantsService: SolutionsService,
    private readonly userTenantService: UserSolutionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Modern API keys are handled by ApiKeyGuard
    // SolutionAuthGuard only validates tenant context, not authentication

    // Try X-Solution-Id header (canonical, post-α), with legacy
    // X-Tenant-Id accepted for one release so external admin tooling
    // and integration scripts keep working during the migration
    // window. Either header value lands in the same Solution lookup.
    const solutionId =
      request.headers['x-solution-id'] ||
      request.headers['x-tenant-id'] ||
      request.query?.solutionId ||
      request.context?.solutionId;

    if (!solutionId) {
      // Use default tenant for development
      const defaultTenantId = this.tenantsService.getDefaultTenantId();
      const defaultTenant = await this.tenantsService.findOne(defaultTenantId);

      if (defaultTenant) {
        request.tenant = defaultTenant;
        request.solutionId = defaultTenant.id;
        this.logger.debug(`Using default tenant: ${defaultTenantId}`);
        return true;
      }

      this.logger.warn('No tenant ID provided and no default tenant found');
      throw new UnauthorizedException('Solution ID required');
    }

    // Validate tenant exists
    const tenant = await this.tenantsService.findOne(solutionId);
    if (!tenant) {
      this.logger.warn(`Invalid tenant ID: ${solutionId}`);
      throw new UnauthorizedException('Invalid tenant');
    }

    if (tenant.status !== 'active') {
      this.logger.warn(`Solution ${solutionId} is not active (status: ${tenant.status})`);
      throw new UnauthorizedException('Solution is not active');
    }

    request.tenant = tenant;
    request.solutionId = tenant.id;

    // Cross-tenant access: if ApiKeyGuard set a context with a different tenant,
    // allow the override only when the API key has 'admin' scope.
    // NOTE: request.context (caller identity) is NEVER modified.
    // request.solutionId and request.tenant (operation target) are already set above.
    const requestContext: RequestContext | undefined = request.context;
    if (requestContext && requestContext.solutionId !== tenant.id) {
      // Admin: unrestricted cross-tenant
      if (requestContext.apiKeyScopes?.includes('admin')) {
        this.logger.log(
          `Admin cross-tenant: key=${requestContext.apiKeyId} from=${requestContext.solutionId} to=${tenant.id}`,
        );
        return true;
      }

      // Builder: cross-tenant to owned tenants only
      if (requestContext.apiKeyScopes?.includes('builder') && requestContext.userId) {
        const userTenant = await this.userTenantService.findUserInTenant(
          requestContext.userId,
          tenant.id,
        );
        if (userTenant && userTenant.isActive) {
          this.logger.log(
            `Builder cross-tenant: user=${requestContext.userId} to=${tenant.id}`,
          );
          return true;
        }
      }

      this.logger.warn(
        `API key tenant ${requestContext.solutionId} does not match X-Solution-Id ${tenant.id} and key lacks permission`,
      );
      throw new ForbiddenException(
        'API key does not have permission to access this tenant',
      );
    }

    return true;
  }
}
