/**
 * API Error Service
 *
 * Tracks API-level errors for debugging and cost analysis.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiErrorEvent, ApiErrorType } from './entities/api-error-event.entity';

export interface CreateApiErrorDto {
  sessionId: string;
  messageId?: string | null;
  errorType: ApiErrorType;
  statusCode?: number | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  retryAfterSeconds?: number | null;
  requestContext?: Record<string, unknown> | null;
  wasRetried?: boolean;
  retryAttempt?: number | null;
}

@Injectable()
export class ApiErrorService {
  private readonly logger = new Logger(ApiErrorService.name);

  constructor(
    @InjectRepository(ApiErrorEvent)
    private readonly errorRepository: Repository<ApiErrorEvent>,
  ) {}

  /**
   * Record an API error event
   */
  async recordError(dto: CreateApiErrorDto): Promise<ApiErrorEvent> {
    const error = this.errorRepository.create({
      sessionId: dto.sessionId,
      messageId: dto.messageId || null,
      errorType: dto.errorType,
      statusCode: dto.statusCode ?? null,
      errorMessage: dto.errorMessage ?? null,
      errorCode: dto.errorCode ?? null,
      retryAfterSeconds: dto.retryAfterSeconds ?? null,
      requestContext: dto.requestContext ?? null,
      wasRetried: dto.wasRetried ?? false,
      retryAttempt: dto.retryAttempt ?? null,
    });

    const saved = await this.errorRepository.save(error);
    this.logger.debug(
      `Recorded ${dto.errorType} error for session ${dto.sessionId}: ${dto.errorMessage || dto.errorCode || 'unknown'}`,
    );
    return saved;
  }

  /**
   * Record a rate limit error
   */
  async recordRateLimit(
    sessionId: string,
    retryAfterSeconds: number,
    messageId?: string,
  ): Promise<ApiErrorEvent> {
    return this.recordError({
      sessionId,
      messageId,
      errorType: 'rate_limit',
      retryAfterSeconds,
      errorCode: 'rate_limit_exceeded',
    });
  }

  /**
   * Record an API error from parsed CLI stderr
   */
  async recordFromStderr(
    sessionId: string,
    stderr: string,
    messageId?: string,
  ): Promise<ApiErrorEvent | null> {
    // Try to parse common error patterns
    const errorInfo = this.parseStderrError(stderr);
    if (!errorInfo || !errorInfo.errorType) return null;

    return this.recordError({
      sessionId,
      messageId,
      errorType: errorInfo.errorType,
      statusCode: errorInfo.statusCode,
      errorMessage: errorInfo.errorMessage,
      retryAfterSeconds: errorInfo.retryAfterSeconds,
    });
  }

  /**
   * Parse stderr for known error patterns
   */
  private parseStderrError(stderr: string): Partial<CreateApiErrorDto> | null {
    // Rate limit pattern
    const rateLimitMatch = stderr.match(/rate.?limit|retry.?after.?(\d+)/i);
    if (rateLimitMatch) {
      return {
        errorType: 'rate_limit',
        errorMessage: stderr.slice(0, 500),
        retryAfterSeconds: rateLimitMatch[1] ? parseInt(rateLimitMatch[1], 10) : null,
      };
    }

    // API error pattern
    const apiErrorMatch = stderr.match(/api.?error|status.?(\d{3})/i);
    if (apiErrorMatch) {
      return {
        errorType: 'api_error',
        errorMessage: stderr.slice(0, 500),
        statusCode: apiErrorMatch[1] ? parseInt(apiErrorMatch[1], 10) : null,
      };
    }

    // Timeout pattern
    if (/timeout|timed?.?out/i.test(stderr)) {
      return {
        errorType: 'timeout',
        errorMessage: stderr.slice(0, 500),
      };
    }

    // Network error pattern
    if (/network|connection|socket|econnrefused|enotfound/i.test(stderr)) {
      return {
        errorType: 'network_error',
        errorMessage: stderr.slice(0, 500),
      };
    }

    // Authentication error pattern
    if (/auth|unauthorized|forbidden|401|403/i.test(stderr)) {
      return {
        errorType: 'authentication_error',
        errorMessage: stderr.slice(0, 500),
      };
    }

    return null;
  }

  /**
   * Get all errors for a session
   */
  async getBySessionId(sessionId: string): Promise<ApiErrorEvent[]> {
    return this.errorRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get errors by type for a session
   */
  async getByType(sessionId: string, errorType: ApiErrorType): Promise<ApiErrorEvent[]> {
    return this.errorRepository.find({
      where: { sessionId, errorType },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get error statistics for a session
   */
  async getSessionStats(sessionId: string): Promise<{
    totalErrors: number;
    byType: Record<ApiErrorType, number>;
    rateLimitCount: number;
    avgRetryAfter: number | null;
  }> {
    const errors = await this.getBySessionId(sessionId);

    const byType: Record<string, number> = {};
    let rateLimitCount = 0;
    let totalRetryAfter = 0;
    let retryAfterCount = 0;

    for (const error of errors) {
      byType[error.errorType] = (byType[error.errorType] || 0) + 1;

      if (error.errorType === 'rate_limit') {
        rateLimitCount++;
        if (error.retryAfterSeconds != null) {
          totalRetryAfter += error.retryAfterSeconds;
          retryAfterCount++;
        }
      }
    }

    return {
      totalErrors: errors.length,
      byType: byType as Record<ApiErrorType, number>,
      rateLimitCount,
      avgRetryAfter: retryAfterCount > 0 ? Math.round(totalRetryAfter / retryAfterCount) : null,
    };
  }

  /**
   * Delete all errors for a session
   */
  async deleteBySessionId(sessionId: string): Promise<number> {
    const result = await this.errorRepository.delete({ sessionId });
    return result.affected || 0;
  }
}
