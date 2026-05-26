/**
 * API Error Event Entity
 *
 * Tracks API-level errors: rate limits, API failures, retries.
 * Important for cost analysis and debugging.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type ApiErrorType =
  | 'rate_limit'
  | 'api_error'
  | 'timeout'
  | 'network_error'
  | 'authentication_error'
  | 'invalid_request'
  | 'server_error'
  | 'unknown';

@Entity('api_error_events')
@Index('IDX_api_error_events_session_created_at', ['sessionId', 'createdAt'])
@Index('IDX_api_error_events_error_type', ['errorType'])
@Index('IDX_api_error_events_tenant_created_at', ['solutionId', 'createdAt'])
export class ApiErrorEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index('IDX_api_error_events_session_id')
  sessionId!: string;

  /**
   * Solution ID for multi-tenancy support
   */
  @Column({ type: 'varchar', nullable: true })
  @Index('IDX_api_error_events_solution_id')
  solutionId?: string;

  /**
   * Associated message ID (if available)
   */
  @Column({ type: 'varchar', nullable: true })
  messageId!: string | null;

  /**
   * Type of API error
   */
  @Column({ type: 'varchar', length: 50 })
  errorType!: ApiErrorType;

  /**
   * HTTP status code (if applicable)
   */
  @Column({ type: 'integer', nullable: true })
  statusCode!: number | null;

  /**
   * Error message from API
   */
  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  /**
   * Error code from API (e.g., 'rate_limit_exceeded')
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode!: string | null;

  /**
   * Retry-after value in seconds (for rate limits)
   */
  @Column({ type: 'integer', nullable: true })
  retryAfterSeconds!: number | null;

  /**
   * Request context (what was being attempted)
   */
  @Column({ type: 'simple-json', nullable: true })
  requestContext!: Record<string, unknown> | null;

  /**
   * Whether this error was retried
   */
  @Column({ type: 'boolean', default: false })
  wasRetried!: boolean;

  /**
   * Retry attempt number (if this is a retry)
   */
  @Column({ type: 'integer', nullable: true })
  retryAttempt!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
