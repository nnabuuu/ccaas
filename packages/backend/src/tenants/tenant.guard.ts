/**
 * Tenant Guard
 *
 * Validates and extracts tenant from requests.
 * Supports API key authentication and X-Tenant-Id header.
 *
 * Sets request.tenantId and request.tenant as the operation target.
 * request.context (caller identity set by ApiKeyGuard) is NEVER modified.
 * Admin API keys may cross-tenant operate via X-Tenant-Id header.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { UserTenantService } from '../users/user-tenant.service';
import type { RequestContext } from '../auth/types';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly userTenantService: UserTenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Modern API keys are handled by ApiKeyGuard
    // TenantGuard only validates tenant context, not authentication

    // Try X-Tenant-Id header, then API key's bound tenant
    const tenantId =
      request.headers['x-tenant-id'] ||
      request.query?.tenantId ||
      request.context?.tenantId;

    if (!tenantId) {
      // Use default tenant for development
      const defaultTenantId = this.tenantsService.getDefaultTenantId();
      const defaultTenant = await this.tenantsService.findOne(defaultTenantId);

      if (defaultTenant) {
        request.tenant = defaultTenant;
        request.tenantId = defaultTenant.id;
        this.logger.debug(`Using default tenant: ${defaultTenantId}`);
        return true;
      }

      this.logger.warn('No tenant ID provided and no default tenant found');
      throw new UnauthorizedException('Tenant ID required');
    }

    // Validate tenant exists
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      this.logger.warn(`Invalid tenant ID: ${tenantId}`);
      throw new UnauthorizedException('Invalid tenant');
    }

    if (tenant.status !== 'active') {
      this.logger.warn(`Tenant ${tenantId} is not active (status: ${tenant.status})`);
      throw new UnauthorizedException('Tenant is not active');
    }

    request.tenant = tenant;
    request.tenantId = tenant.id;

    // Cross-tenant access: if ApiKeyGuard set a context with a different tenant,
    // allow the override only when the API key has 'admin' scope.
    // NOTE: request.context (caller identity) is NEVER modified.
    // request.tenantId and request.tenant (operation target) are already set above.
    const requestContext: RequestContext | undefined = request.context;
    if (requestContext && requestContext.tenantId !== tenant.id) {
      // Admin: unrestricted cross-tenant
      if (requestContext.apiKeyScopes?.includes('admin')) {
        this.logger.log(
          `Admin cross-tenant: key=${requestContext.apiKeyId} from=${requestContext.tenantId} to=${tenant.id}`,
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
        `API key tenant ${requestContext.tenantId} does not match X-Tenant-Id ${tenant.id} and key lacks permission`,
      );
      throw new ForbiddenException(
        'API key does not have permission to access this tenant',
      );
    }

    return true;
  }
}
