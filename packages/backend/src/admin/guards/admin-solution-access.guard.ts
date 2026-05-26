/**
 * Admin Solution Access Guard
 *
 * Enforces tenant isolation for builder keys on admin endpoints.
 * - Admin scope → unrestricted (pass-through)
 * - Builder scope → only allowed to access tenants they own
 *
 * Extracts target solutionId from:
 *   1. Route params: :solutionId (explicit only — NOT :id, which may be a non-tenant resource)
 *   2. Query params: ?solutionId=
 *   3. Request body: { solutionId: '...' }
 *   4. Header: X-Solution-Id
 *
 * If no solutionId can be determined, the guard passes through
 * (list endpoints handle their own filtering).
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UserSolutionService } from '../../users/user-solution.service';
import type { RequestContext } from '../../auth/types';

/** Check if the request context has admin scope (unrestricted access). */
export function isAdminScope(ctx: RequestContext | undefined): boolean {
  return ctx?.apiKeyScopes?.includes('admin') ?? false;
}

@Injectable()
export class AdminSolutionAccessGuard implements CanActivate {
  private readonly logger = new Logger(AdminSolutionAccessGuard.name);

  constructor(
    private readonly userTenantService: UserSolutionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const requestContext: RequestContext | undefined = request.context;

    // No context (shouldn't happen after ApiKeyGuard, but be safe)
    if (!requestContext) {
      return true;
    }

    // Admin scope → unrestricted access
    if (requestContext.apiKeyScopes?.includes('admin')) {
      return true;
    }

    // Only apply tenant isolation for builder keys
    if (!requestContext.apiKeyScopes?.includes('builder')) {
      return true;
    }

    // Extract target solutionId from various sources
    const targetTenantId = this.extractTenantId(request);

    // No solutionId in request → pass through (list endpoints filter internally)
    if (!targetTenantId) {
      return true;
    }

    // Builder accessing their own tenant (from API key) → allow
    if (requestContext.solutionId === targetTenantId) {
      return true;
    }

    // Cross-tenant: verify builder owns the target tenant
    if (!requestContext.userId) {
      this.logger.warn(
        `Builder key without userId attempted cross-tenant access to ${targetTenantId}`,
      );
      throw new ForbiddenException(
        'Builder key does not have permission to access this tenant',
      );
    }

    const userTenant = await this.userTenantService.findUserInTenant(
      requestContext.userId,
      targetTenantId,
    );

    if (userTenant && userTenant.isActive) {
      this.logger.debug(
        `Builder cross-tenant allowed: user=${requestContext.userId} tenant=${targetTenantId}`,
      );
      return true;
    }

    this.logger.warn(
      `Builder key user=${requestContext.userId} denied access to tenant ${targetTenantId}`,
    );
    throw new ForbiddenException(
      'Builder key does not have permission to access this tenant',
    );
  }

  private extractTenantId(request: any): string | undefined {
    // 1. Route params — only explicit :solutionId (NOT :id, which may be an API key, MCP server, etc.)
    if (request.params?.solutionId) return request.params.solutionId;

    // 2. Query params
    if (request.query?.solutionId) return request.query.solutionId;

    // 3. Request body
    if (request.body?.solutionId) return request.body.solutionId;

    // 4. Header
    const headerSolutionId = request.headers?.['x-solution-id'];
    if (headerSolutionId) return headerSolutionId;

    return undefined;
  }
}
