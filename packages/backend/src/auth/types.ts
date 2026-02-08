/**
 * Auth Module Types
 *
 * Type definitions for authentication and authorization.
 */

import type { Tenant } from '../tenants/entities/tenant.entity';
import type { User } from '../users/entities/user.entity';
import type { UserTenant } from '../users/entities/user-tenant.entity';

// ============================================================================
// API KEY TYPES
// ============================================================================

export type ApiKeyScope =
  | 'skills:read'
  | 'skills:write'
  | 'skills:execute'
  | 'skills:delete'
  | 'mcp:read'
  | 'mcp:write'
  | 'chat'
  | 'analytics:read'
  | 'admin';

export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

export interface ApiKeyMetadata {
  description?: string;
  environment?: 'development' | 'staging' | 'production';
  ipWhitelist?: string[];
  customData?: Record<string, unknown>;
}

// ============================================================================
// REQUEST CONTEXT
// ============================================================================

export interface RequestContext {
  tenantId: string;
  tenant: Tenant;
  apiKeyId?: string;
  apiKeyScopes?: ApiKeyScope[];
  userId?: string;
  user?: User;
  userTenant?: UserTenant; // User-tenant association with role
  requestId: string;
  timestamp: Date;
  isAnonymous?: boolean;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay?: number;
  windowMs?: number;
}

// ============================================================================
// AUTH ERRORS
// ============================================================================

export class AuthenticationError extends Error {
  constructor(
    message: string = 'Authentication failed',
    public readonly code: string = 'AUTH_FAILED',
    public readonly statusCode: number = 401,
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string = 'Permission denied',
    public readonly code: string = 'PERMISSION_DENIED',
    public readonly statusCode: number = 403,
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends Error {
  constructor(
    public readonly retryAfter: number,
    message: string = `Rate limit exceeded. Retry after ${retryAfter}ms`,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const API_KEY_PREFIX = 'sk-';

export const DEFAULT_SCOPES: ApiKeyScope[] = [
  'skills:read',
  'skills:execute',
  'chat',
];

export const ALL_SCOPES: ApiKeyScope[] = [
  'skills:read',
  'skills:write',
  'skills:execute',
  'skills:delete',
  'mcp:read',
  'mcp:write',
  'chat',
  'analytics:read',
  'admin',
];
