/**
 * Global HTTP Exception Filter
 *
 * Handles all HTTP exceptions and transforms them into standardized error responses.
 * Integrates with the protocol ErrorCode system for consistency with WebSocket errors.
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ProtocolHttpException,
  HttpErrorResponse,
} from '../../protocol/http-exceptions';
import { httpStatusToErrorCode } from '../../protocol/http-error-mapping';
import type { ErrorCode } from '../../protocol/errors';

/**
 * Generate unique request ID (simple implementation)
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Global HTTP exception filter
 *
 * Handles all exceptions thrown during HTTP request processing:
 * 1. ProtocolHttpException - Use error code and response structure
 * 2. NestJS HttpException - Map to protocol ErrorCode via fallback
 * 3. Custom domain errors (with statusCode) - Preserve statusCode, add protocol code
 * 4. Uncaught errors - Map to INTERNAL_ERROR, log stack trace
 */
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate request ID if not already present
    const requestId =
      (request.headers['x-request-id'] as string) || generateRequestId();

    const errorResponse = this.createErrorResponse(
      exception,
      request.path,
      requestId,
    );

    // Log error with context
    this.logError(exception, errorResponse, request);

    // Send response
    response.status(errorResponse.statusCode).json(errorResponse);
  }

  /**
   * Create standardized error response from exception
   */
  private createErrorResponse(
    exception: unknown,
    path: string,
    requestId: string,
  ): HttpErrorResponse {
    // 1. Handle ProtocolHttpException
    if (exception instanceof ProtocolHttpException) {
      return exception.toResponse(path, requestId);
    }

    // 2. Handle NestJS HttpException
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, path, requestId);
    }

    // 3. Handle custom domain errors with statusCode property
    if (this.hasStatusCode(exception)) {
      return this.handleDomainError(exception, path, requestId);
    }

    // 4. Handle uncaught errors
    return this.handleUncaughtError(exception, path, requestId);
  }

  /**
   * Handle NestJS HttpException
   */
  private handleHttpException(
    exception: HttpException,
    path: string,
    requestId: string,
  ): HttpErrorResponse {
    const statusCode = exception.getStatus();
    const errorCode = httpStatusToErrorCode(statusCode);
    const exceptionResponse = exception.getResponse();

    // Extract message from response
    let message = exception.message;
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const response = exceptionResponse as any;
      message = response.message || response.error || exception.message;
      if (Array.isArray(message)) {
        message = message.join(', ');
      }
    }

    return {
      code: errorCode,
      message,
      statusCode,
      recoverable: false,
      retryable: this.isRetryableStatus(statusCode),
      timestamp: new Date().toISOString(),
      path,
      requestId,
    };
  }

  /**
   * Handle custom domain errors with statusCode property
   */
  private handleDomainError(
    exception: any,
    path: string,
    requestId: string,
  ): HttpErrorResponse {
    const statusCode = exception.statusCode || 500;
    const code: ErrorCode = exception.code || httpStatusToErrorCode(statusCode);
    const message = exception.message || 'Internal server error';

    // Handle rate limit errors with retryAfter
    const retryAfterMs =
      exception.retryAfter || exception.retryAfterMs || undefined;

    return {
      code,
      message,
      statusCode,
      recoverable: this.isRecoverable(code),
      retryable: this.isRetryableStatus(statusCode),
      timestamp: new Date().toISOString(),
      path,
      requestId,
      retryAfterMs,
    };
  }

  /**
   * Handle uncaught errors
   */
  private handleUncaughtError(
    exception: unknown,
    path: string,
    requestId: string,
  ): HttpErrorResponse {
    const message =
      exception instanceof Error
        ? exception.message
        : 'An unexpected error occurred';

    return {
      code: 'INTERNAL_ERROR',
      message,
      statusCode: 500,
      recoverable: false,
      retryable: false,
      timestamp: new Date().toISOString(),
      path,
      requestId,
    };
  }

  /**
   * Check if exception has statusCode property
   */
  private hasStatusCode(exception: unknown): exception is {
    statusCode: number;
    message: string;
    code?: string;
  } {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'statusCode' in exception &&
      typeof (exception as any).statusCode === 'number'
    );
  }

  /**
   * Check if error code is recoverable
   */
  private isRecoverable(code: ErrorCode): boolean {
    const recoverableErrors: ErrorCode[] = [
      'TIMEOUT',
      'RATE_LIMITED',
      'CONNECTION_LOST',
      'MCP_ERROR',
      'CLI_ERROR',
      'PARTIAL_FAILURE',
    ];
    return recoverableErrors.includes(code);
  }

  /**
   * Check if HTTP status is retryable
   */
  private isRetryableStatus(statusCode: number): boolean {
    // Retry on server errors (5xx) and rate limiting (429)
    return statusCode >= 500 || statusCode === 429;
  }

  /**
   * Log error with context
   */
  private logError(
    exception: unknown,
    errorResponse: HttpErrorResponse,
    request: Request,
  ): void {
    const logContext = {
      requestId: errorResponse.requestId,
      path: errorResponse.path,
      method: request.method,
      code: errorResponse.code,
      statusCode: errorResponse.statusCode,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };

    // Log stack trace for server errors
    if (errorResponse.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `HTTP ${errorResponse.statusCode} - ${errorResponse.message}`,
        stack,
        JSON.stringify(logContext),
      );
    } else {
      // Log as warning for client errors
      this.logger.warn(
        `HTTP ${errorResponse.statusCode} - ${errorResponse.message}`,
        JSON.stringify(logContext),
      );
    }
  }
}
