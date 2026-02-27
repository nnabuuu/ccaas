/**
 * Auth Decorators
 *
 * Custom decorators for authentication and authorization.
 */

import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import type { ApiKeyScope, RequestContext } from '../types';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ScopesGuard } from '../guards/scopes.guard';

// ============================================================================
// METADATA KEYS
// ============================================================================

export const IS_PUBLIC_KEY = 'isPublic';
export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
export const REQUIRED_SCOPES_KEY = 'requiredScopes';
export const REQUIRED_ANY_SCOPES_KEY = 'requiredAnyScopes';

// ============================================================================
// ROUTE DECORATORS
// ============================================================================

/**
 * Mark a route as public (no authentication required)
 *
 * @example
 * @Public()
 * @Get('health')
 * health() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Mark a route as having optional authentication.
 * If API key is provided, it will be validated and context attached.
 * If no key, anonymous context will be used if allowed.
 *
 * @example
 * @OptionalAuth()
 * @Get('skills')
 * listSkills() { ... }
 */
export const OptionalAuth = () => applyDecorators(
  UseGuards(ApiKeyGuard),
  SetMetadata(IS_OPTIONAL_AUTH_KEY, true),
);

/**
 * Require specific scopes for accessing the route.
 * All listed scopes must be present (AND logic).
 *
 * @example
 * @RequireScopes('skills:write', 'skills:delete')
 * @Delete(':id')
 * deleteSkill() { ... }
 */
export const RequireScopes = (...scopes: ApiKeyScope[]) =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes);

/**
 * Require any of the listed scopes (OR logic).
 *
 * @example
 * @RequireAnyScope('skills:read', 'admin')
 * @Get(':id')
 * getSkill() { ... }
 */
export const RequireAnyScope = (...scopes: ApiKeyScope[]) =>
  SetMetadata(REQUIRED_ANY_SCOPES_KEY, scopes);

/**
 * Combined decorator that applies ApiKeyGuard and ScopesGuard with required scopes
 *
 * @example
 * @Auth('skills:write')
 * @Post()
 * createSkill() { ... }
 */
export const Auth = (...scopes: ApiKeyScope[]) => {
  if (scopes.length === 0) {
    return applyDecorators(UseGuards(ApiKeyGuard));
  }
  return applyDecorators(
    UseGuards(ApiKeyGuard, ScopesGuard),
    RequireScopes(...scopes),
  );
};

// ============================================================================
// PARAMETER DECORATORS
// ============================================================================

/**
 * Get the full request context from the authenticated request
 *
 * @example
 * @Get()
 * async list(@Ctx() ctx: RequestContext) {
 *   const tenantId = ctx.tenantId;
 * }
 */
export const Ctx = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestContext | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.context;
  },
);

/**
 * Get the tenant ID from the authenticated request
 *
 * @example
 * @Get()
 * async list(@TenantId() tenantId: string) { ... }
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    // Prefer operation target (set by TenantGuard), fallback to caller identity (for admin routes without TenantGuard)
    return request.tenantId ?? request.context?.tenantId;
  },
);

/**
 * Get the API key ID from the authenticated request
 *
 * @example
 * @Get()
 * async list(@ApiKeyId() keyId: string | undefined) { ... }
 */
export const ApiKeyId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.context?.apiKeyId;
  },
);

/**
 * Get the request ID from the authenticated request
 *
 * @example
 * @Get()
 * async list(@RequestId() requestId: string) { ... }
 */
export const RequestId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.context?.requestId;
  },
);

// Re-export CurrentUser from dedicated file
export { CurrentUser, type CurrentUserData } from './current-user.decorator';
