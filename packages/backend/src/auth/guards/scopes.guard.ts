/**
 * Scopes Guard
 *
 * NestJS guard for scope-based authorization.
 * Checks if the authenticated API key has required scopes.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from '../api-key.service';
import { REQUIRED_SCOPES_KEY, REQUIRED_ANY_SCOPES_KEY } from '../decorators';
import type { ApiKeyScope } from '../types';

@Injectable()
export class ScopesGuard implements CanActivate {
  private readonly logger = new Logger(ScopesGuard.name);

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required scopes from decorator
    const requiredScopes = this.reflector.getAllAndOverride<ApiKeyScope[]>(
      REQUIRED_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredAnyScopes = this.reflector.getAllAndOverride<ApiKeyScope[]>(
      REQUIRED_ANY_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no scopes required, allow access
    if (!requiredScopes?.length && !requiredAnyScopes?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const requestContext = request.context;

    // If no context (public route or unauthenticated), deny
    if (!requestContext) {
      throw new ForbiddenException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required for this endpoint',
      });
    }

    // Anonymous users (no API key) can't access scoped endpoints
    if (requestContext.isAnonymous) {
      this.logger.warn('Anonymous user attempted to access scoped endpoint');
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'API key with required scopes is needed for this endpoint',
      });
    }

    const scopes = requestContext.apiKeyScopes;

    // Check "all" scopes requirement
    if (requiredScopes?.length) {
      if (!this.apiKeyService.hasAllScopes(scopes, requiredScopes)) {
        const missing = requiredScopes.filter((s) => !scopes?.includes(s));
        this.logger.warn(
          `API key missing required scopes: ${missing.join(', ')}`,
        );
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message: `Missing required scopes: ${missing.join(', ')}`,
          requiredScopes,
        });
      }
    }

    // Check "any" scopes requirement
    if (requiredAnyScopes?.length) {
      if (!this.apiKeyService.hasAnyScope(scopes, requiredAnyScopes)) {
        this.logger.warn(
          `API key missing any of required scopes: ${requiredAnyScopes.join(', ')}`,
        );
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message: `Requires at least one of: ${requiredAnyScopes.join(', ')}`,
          requiredScopes: requiredAnyScopes,
        });
      }
    }

    return true;
  }
}
