/**
 * Error Handling Protocol
 *
 * Error types, codes, and recovery patterns for agent errors.
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Standard error codes for agent errors
 */
export type ErrorCode =
  | 'TIMEOUT' // Claude took too long
  | 'RATE_LIMITED' // API rate limit hit
  | 'INVALID_OUTPUT' // Claude output failed validation
  | 'PARTIAL_FAILURE' // Some fields generated, others failed
  | 'CONNECTION_LOST' // WebSocket disconnected
  | 'SESSION_EXPIRED' // Session TTL exceeded
  | 'NOT_FOUND'       // Generic resource not found (route, tenant, etc.)
  | 'SKILL_NOT_FOUND' // Requested skill doesn't exist
  | 'PERMISSION_DENIED' // API key lacks required scope
  | 'INTERNAL_ERROR' // Unexpected server error
  | 'CLI_ERROR' // Claude CLI process error
  | 'MCP_ERROR' // MCP server error
  | 'VALIDATION_ERROR' // Input validation failed
  | 'QUOTA_EXCEEDED' // Tenant token quota exceeded
  | 'ALREADY_EXISTS'; // Resource already exists (duplicate slug, email, etc.)

// ============================================================================
// Error Events
// ============================================================================

/**
 * Agent error event
 */
export interface AgentErrorEvent {
  type: 'agent_error';
  sessionId: string;
  error: {
    code: ErrorCode;
    message: string;
    recoverable: boolean;
    retryable: boolean;
    retryAfterMs?: number;
    partialOutput?: Record<string, unknown>;
    failedFields?: string[];
  };
  timestamp: string;
}

/**
 * Partial output event - when some fields succeed but others fail
 */
export interface PartialOutputEvent {
  type: 'partial_output';
  sessionId: string;
  payload: {
    completedFields: string[];
    failedFields: string[];
    partialData: Record<string, unknown>;
    canRetry: boolean;
    retryableFields: string[];
  };
  timestamp: string;
}

// ============================================================================
// Retry Policy
// ============================================================================

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCode[];
}

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['TIMEOUT', 'RATE_LIMITED', 'CONNECTION_LOST'],
};

/**
 * Retry hint from server
 */
export interface RetryHint {
  shouldRetry: boolean;
  retryAfterMs: number;
  retryCount: number;
  maxRetries: number;
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Calculate next retry delay using exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): number {
  const delay =
    policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt);
  return Math.min(delay, policy.maxDelayMs);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(
  code: ErrorCode,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): boolean {
  return policy.retryableErrors.includes(code);
}

/**
 * Create a standardized error response
 */
export function createErrorEvent(
  sessionId: string,
  code: ErrorCode,
  message: string,
  options: {
    recoverable?: boolean;
    retryable?: boolean;
    retryAfterMs?: number;
    partialOutput?: Record<string, unknown>;
    failedFields?: string[];
  } = {},
): AgentErrorEvent {
  return {
    type: 'agent_error',
    sessionId,
    error: {
      code,
      message,
      recoverable: options.recoverable ?? isRetryableError(code),
      retryable: options.retryable ?? isRetryableError(code),
      retryAfterMs: options.retryAfterMs,
      partialOutput: options.partialOutput,
      failedFields: options.failedFields,
    },
    timestamp: new Date().toISOString(),
  };
}
