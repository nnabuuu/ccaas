/**
 * Protocol HTTP Exceptions
 *
 * HTTP exception classes that integrate with the protocol ErrorCode system.
 * All exceptions extend NestJS HttpException for compatibility with existing filters.
 */

import { HttpException } from '@nestjs/common';
import type { ErrorCode } from './errors';
import { getHttpStatus } from './http-error-mapping';

/**
 * Structured error response format
 */
export interface HttpErrorResponse {
  code: ErrorCode;
  message: string;
  statusCode: number;
  recoverable: boolean;
  retryable: boolean;
  timestamp: string;
  path?: string;
  requestId?: string;
  retryAfterMs?: number;
  failedFields?: string[];
  partialOutput?: Record<string, unknown>;
}

/**
 * Base class for protocol-aware HTTP exceptions
 */
export class ProtocolHttpException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    message: string,
    public readonly recoverable: boolean = false,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number,
    public readonly failedFields?: string[],
    public readonly partialOutput?: Record<string, unknown>,
  ) {
    const statusCode = getHttpStatus(errorCode);
    super(message, statusCode);
    this.name = 'ProtocolHttpException';
  }

  /**
   * Create structured error response
   */
  toResponse(path?: string, requestId?: string): HttpErrorResponse {
    return {
      code: this.errorCode,
      message: this.message,
      statusCode: this.getStatus(),
      recoverable: this.recoverable,
      retryable: this.retryable,
      timestamp: new Date().toISOString(),
      path,
      requestId,
      retryAfterMs: this.retryAfterMs,
      failedFields: this.failedFields,
      partialOutput: this.partialOutput,
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationException extends ProtocolHttpException {
  constructor(
    message: string = 'Validation failed',
    failedFields?: string[],
  ) {
    super('VALIDATION_ERROR', message, false, false, undefined, failedFields);
    this.name = 'ValidationException';
  }
}

/**
 * Skill not found error (404)
 */
export class SkillNotFoundException extends ProtocolHttpException {
  constructor(skillId: string) {
    super('SKILL_NOT_FOUND', `Skill not found: ${skillId}`, false, false);
    this.name = 'SkillNotFoundException';
  }
}

/**
 * Generic resource not found error (404)
 */
export class ResourceNotFoundException extends ProtocolHttpException {
  constructor(message: string = 'Resource not found') {
    super('NOT_FOUND', message, false, false);
    this.name = 'ResourceNotFoundException';
  }
}

/**
 * Permission denied error (403)
 */
export class PermissionDeniedException extends ProtocolHttpException {
  constructor(message: string = 'Permission denied') {
    super('PERMISSION_DENIED', message, false, false);
    this.name = 'PermissionDeniedException';
  }
}

/**
 * Session expired / authentication error (401)
 */
export class SessionExpiredException extends ProtocolHttpException {
  constructor(messageOrSessionId?: string) {
    // If it looks like a session ID (uuid-like), format as "Session expired: {id}"
    // Otherwise use the message as-is
    const isSessionId = messageOrSessionId && /^[a-f0-9-]{20,}$/i.test(messageOrSessionId);
    const message = messageOrSessionId
      ? isSessionId
        ? `Session expired: ${messageOrSessionId}`
        : messageOrSessionId
      : 'Session expired';
    super('SESSION_EXPIRED', message, false, false);
    this.name = 'SessionExpiredException';
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitedException extends ProtocolHttpException {
  constructor(retryAfterMs: number = 60000) {
    super(
      'RATE_LIMITED',
      `Rate limit exceeded. Retry after ${retryAfterMs}ms`,
      true,
      true,
      retryAfterMs,
    );
    this.name = 'RateLimitedException';
  }
}

/**
 * Already exists / conflict error (409)
 */
export class AlreadyExistsException extends ProtocolHttpException {
  constructor(message: string = 'Resource already exists') {
    super('ALREADY_EXISTS', message, false, false);
    this.name = 'AlreadyExistsException';
  }
}

/**
 * Quota exceeded error (429)
 */
export class QuotaExceededException extends ProtocolHttpException {
  public readonly quota: {
    limit: number;
    used: number;
    period: string;
    resetsAt: string;
  };

  constructor(quota: { limit: number; used: number; period: string; resetsAt: string }) {
    super(
      'QUOTA_EXCEEDED',
      `Monthly token quota exceeded (${quota.limit.toLocaleString()} tokens)`,
      false,
      false,
    );
    this.name = 'QuotaExceededException';
    this.quota = quota;
  }

  override toResponse(path?: string, requestId?: string) {
    return {
      ...super.toResponse(path, requestId),
      quota: this.quota,
    };
  }
}

/**
 * Timeout error (504)
 */
export class TimeoutException extends ProtocolHttpException {
  constructor(message: string = 'Request timeout') {
    super('TIMEOUT', message, true, true);
    this.name = 'TimeoutException';
  }
}

/**
 * Internal server error (500)
 */
export class InternalException extends ProtocolHttpException {
  constructor(message: string = 'Internal server error') {
    super('INTERNAL_ERROR', message, false, false);
    this.name = 'InternalException';
  }
}

/**
 * MCP server error (502)
 */
export class McpException extends ProtocolHttpException {
  constructor(message: string, details?: Record<string, unknown>) {
    super('MCP_ERROR', message, true, true, undefined, undefined, details);
    this.name = 'McpException';
  }
}

/**
 * Connection lost error (503)
 */
export class ConnectionLostException extends ProtocolHttpException {
  constructor(message: string = 'Connection lost') {
    super('CONNECTION_LOST', message, true, true);
    this.name = 'ConnectionLostException';
  }
}

/**
 * Invalid output error (500)
 */
export class InvalidOutputException extends ProtocolHttpException {
  constructor(
    message: string = 'Invalid output format',
    failedFields?: string[],
  ) {
    super('INVALID_OUTPUT', message, false, false, undefined, failedFields);
    this.name = 'InvalidOutputException';
  }
}

/**
 * Partial failure error (500)
 */
export class PartialFailureException extends ProtocolHttpException {
  constructor(
    message: string,
    failedFields: string[],
    partialOutput?: Record<string, unknown>,
  ) {
    super(
      'PARTIAL_FAILURE',
      message,
      true,
      true,
      undefined,
      failedFields,
      partialOutput,
    );
    this.name = 'PartialFailureException';
  }
}

/**
 * CLI error (500)
 */
export class CliException extends ProtocolHttpException {
  constructor(message: string = 'CLI process error') {
    super('CLI_ERROR', message, true, true);
    this.name = 'CliException';
  }
}
