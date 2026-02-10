/**
 * MCP Module Types
 *
 * Type definitions for MCP server management and REST adapters.
 */

// ============================================================================
// MCP SERVER TYPES
// ============================================================================

export type McpServerType = 'builtin' | 'custom' | 'rest-adapter';
export type McpServerStatus = 'active' | 'disabled' | 'error';
export type McpHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * MCP Tool definition
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
  /** For custom MCP servers - command to run */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** For REST adapter type */
  restAdapter?: RestAdapterConfig;
}

// ============================================================================
// REST ADAPTER TYPES
// ============================================================================

export interface RestAdapterConfig {
  baseUrl: string;
  auth: RestAdapterAuth;
  oauth2?: OAuth2Config;
  endpoints: RestEndpoint[];
  rateLimiting?: RateLimitConfig;
  errorMapping?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface RestAdapterAuth {
  type: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2';
  apiKeyName?: string;
  apiKeyLocation?: 'header' | 'query';
  apiKeyValue?: string;
  token?: string;
  username?: string;
  password?: string;
  headerName?: string;
  headerPrefix?: string;
}

export interface OAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  grantType?: 'client_credentials' | 'password' | 'authorization_code';
}

export interface RestEndpoint {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  pathParams?: Record<string, ParamSchema>;
  queryParams?: Record<string, ParamSchema>;
  body?: BodySchema;
  responseMapping?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface ParamSchema {
  type: 'string' | 'integer' | 'number' | 'boolean';
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
}

export interface BodySchema {
  type: 'json' | 'form' | 'multipart';
  schema: Record<string, ParamSchema>;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay?: number;
  retryAfterMs?: number;
  maxRetries?: number;
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  statusCode?: number;
  duration: number;
}

export interface HealthCheckResult {
  status: McpHealthStatus;
  lastCheck?: Date;
  latencyMs?: number;
  message?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

// MCP errors are now defined in protocol/http-exceptions.ts
// Import them from there:
// - McpException (502) - for MCP server errors
// - ValidationException (400) - for validation errors
