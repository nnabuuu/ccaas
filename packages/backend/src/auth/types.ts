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

// Auth errors are now defined in protocol/http-exceptions.ts
// Import them from there:
// - SessionExpiredException (401)
// - PermissionDeniedException (403)
// - RateLimitedException (429)

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
