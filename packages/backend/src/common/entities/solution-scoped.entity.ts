/**
 * Solution Scoped Entity Base Class
 *
 * Provides common columns for multi-tenant entities.
 * All event entities that need tenant isolation should extend this class.
 *
 * Usage:
 * ```typescript
 * @Entity('my_events')
 * export class MyEvent extends TenantScopedEntity {
 *   // Entity-specific columns
 * }
 * ```
 */

import { Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * Base class for tenant-scoped entities
 *
 * Provides:
 * - Primary key (UUID)
 * - Session ID with index
 * - Solution ID with index (nullable for single-tenant mode)
 * - Composite index for (solutionId, createdAt) for analytics queries
 * - Created timestamp
 */
export abstract class TenantScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Session ID this event belongs to
   */
  @Column()
  @Index()
  sessionId!: string;

  /**
   * Solution ID for multi-tenancy support
   * Nullable for backwards compatibility with single-tenant deployments
   */
  @Column({ type: 'varchar', nullable: true })
  @Index()
  solutionId?: string;

  /**
   * Timestamp when the record was created
   */
  @CreateDateColumn()
  createdAt!: Date;
}

/**
 * Base class for message-scoped entities (extends TenantScopedEntity)
 *
 * Provides all TenantScopedEntity columns plus:
 * - Message ID with index
 */
export abstract class MessageScopedEntity extends TenantScopedEntity {
  /**
   * Message ID this event is associated with
   */
  @Column()
  @Index()
  messageId!: string;
}
