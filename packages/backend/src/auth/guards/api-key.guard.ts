/**
 * API Key Guard
 *
 * NestJS guard for API key authentication.
 * Extracts API key from headers and validates it.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from '../api-key.service';
import { IS_PUBLIC_KEY, IS_OPTIONAL_AUTH_KEY } from '../decorators';
import type { RequestContext } from '../types';
import {
  SessionExpiredException,
  RateLimitedException,
} from '../../protocol/http-exceptions';

/**
 * Extended Express Request with auth context
 */
export interface AuthenticatedRequest extends Request {
  context: RequestContext;
  tenantId: string;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const rawKey = this.extractApiKey(request);

    // Check if auth is optional
    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    try {
      // Create context (will use anonymous if no key and allowed)
      const requestContext = await this.apiKeyService.createContext(rawKey);

      // Attach context to request
      request.context = requestContext;
      request.tenantId = requestContext.tenantId;
      request.tenant = requestContext.tenant;

      return true;
    } catch (error) {
      // For optional auth, allow anonymous access even on errors
      if (isOptionalAuth && !rawKey) {
        return this.handleOptionalAuth(request);
      }

      // Handle specific error types
      if (error instanceof SessionExpiredException) {
        throw new UnauthorizedException({
          code: error.errorCode,
          message: error.message,
        });
      }

      if (error instanceof RateLimitedException) {
        throw new UnauthorizedException({
          code: error.errorCode,
          message: error.message,
          retryAfter: error.retryAfterMs,
        });
      }

      this.logger.error(`Authentication error: ${error}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Extract API key from request headers
   */
  private extractApiKey(request: any): string | undefined {
    const authHeader = request.headers?.authorization;

    if (authHeader) {
      // Bearer token format
      if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
      }
      // Direct key format
      if (authHeader.startsWith('sk-')) {
        return authHeader;
      }
    }

    // X-API-Key header
    const xApiKey = request.headers?.['x-api-key'];
    if (xApiKey) {
      return xApiKey;
    }

    return undefined;
  }

  /**
   * Handle optional auth - try to get context but don't fail
   */
  private async handleOptionalAuth(request: any): Promise<boolean> {
    try {
      const requestContext = await this.apiKeyService.createContext();
      request.context = requestContext;
      request.tenantId = requestContext.tenantId;
      request.tenant = requestContext.tenant;
      return true;
    } catch {
      // Even anonymous access failed, but auth is optional
      // Set minimal context
      request.context = null;
      return true;
    }
  }
}
