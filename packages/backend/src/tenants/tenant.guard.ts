/**
 * Tenant Guard
 *
 * Validates and extracts tenant from requests.
 * Supports API key authentication and X-Tenant-Id header.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private readonly tenantsService: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Modern API keys are handled by ApiKeyGuard
    // TenantGuard only validates tenant context, not authentication

    // Try X-Tenant-Id header
    const tenantId =
      request.headers['x-tenant-id'] || request.query?.tenantId;

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
    return true;
  }
}
