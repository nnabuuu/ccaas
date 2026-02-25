/**
 * HTTP Error Mapping
 *
 * Maps protocol ErrorCode to HTTP status codes.
 */

import type { ErrorCode } from './errors';

/**
 * Map protocol ErrorCode to HTTP status code
 */
export const ERROR_CODE_TO_HTTP_STATUS: Record<ErrorCode, number> = {
  // Client errors (4xx)
  VALIDATION_ERROR: 400, // Bad Request
  PERMISSION_DENIED: 403, // Forbidden
  NOT_FOUND: 404,       // Not Found (generic)
  SKILL_NOT_FOUND: 404, // Not Found
  SESSION_EXPIRED: 401, // Unauthorized
  RATE_LIMITED: 429, // Too Many Requests

  // Server errors (5xx)
  TIMEOUT: 504, // Gateway Timeout
  INTERNAL_ERROR: 500, // Internal Server Error
  CLI_ERROR: 500, // Internal Server Error
  CONNECTION_LOST: 503, // Service Unavailable
  MCP_ERROR: 502, // Bad Gateway
  INVALID_OUTPUT: 500, // Internal Server Error
  PARTIAL_FAILURE: 500, // Internal Server Error
};

/**
 * Get HTTP status code for an error code
 */
export function getHttpStatus(code: ErrorCode): number {
  return ERROR_CODE_TO_HTTP_STATUS[code] ?? 500;
}

/**
 * Check if error code represents a client error (4xx)
 */
export function isClientError(code: ErrorCode): boolean {
  const status = getHttpStatus(code);
  return status >= 400 && status < 500;
}

/**
 * Check if error code represents a server error (5xx)
 */
export function isServerError(code: ErrorCode): boolean {
  const status = getHttpStatus(code);
  return status >= 500 && status < 600;
}

/**
 * Map HTTP status code to a fallback ErrorCode (for non-protocol exceptions)
 */
export function httpStatusToErrorCode(statusCode: number): ErrorCode {
  if (statusCode === 400) return 'VALIDATION_ERROR';
  if (statusCode === 401) return 'SESSION_EXPIRED';
  if (statusCode === 403) return 'PERMISSION_DENIED';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 429) return 'RATE_LIMITED';
  if (statusCode === 502) return 'MCP_ERROR';
  if (statusCode === 503) return 'CONNECTION_LOST';
  if (statusCode === 504) return 'TIMEOUT';
  return 'INTERNAL_ERROR';
}
