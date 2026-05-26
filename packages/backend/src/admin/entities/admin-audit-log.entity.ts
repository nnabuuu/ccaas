/**
 * Admin Audit Log Entity
 *
 * Tracks all admin actions for compliance and debugging.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type AdminAction =
  | 'skill.create'
  | 'skill.update'
  | 'skill.publish'
  | 'skill.archive'
  | 'skill.rollback'
  | 'session.kill'
  | 'session.bulk_kill'
  | 'session.restart'
  | 'apikey.create'
  | 'apikey.revoke'
  | 'apikey.update'
  | 'apikey.delete'
  // `tenant.*` action names are @load-bearing — they're persisted in
  // the audit log table. α renamed the entity to Solution but the
  // historical action strings stay because changing them would break
  // log queries filtering by action. Treat as opaque audit identifiers.
  | 'tenant.create'
  | 'tenant.update'
  | 'alert.create'
  | 'alert.update'
  | 'alert.delete'
  | 'sessionTemplate.create'
  | 'sessionTemplate.update'
  | 'sessionTemplate.delete'
  | 'sessionTemplate.sync'
  | 'mcp.create'
  | 'mcp.update'
  | 'mcp.delete'
  | 'builderUser.create'
  | 'user.create'
  | 'user.update'
  | 'user.role_update'
  | 'user.delete';

/**
 * @load-bearing values — the string `'tenant'` is persisted in the
 * `admin_audit_log.targetType` column. α (2026-05-26) renamed the
 * Tenant entity to Solution but this enum value stays because audit
 * queries filter by exact string match. Treat as opaque audit
 * identifier; do NOT rename to `'solution'` without a coordinated
 * data migration that rewrites historical rows.
 */
export type TargetType =
  | 'skill'
  | 'session'
  | 'apikey'
  | 'tenant'
  | 'alert'
  | 'mcp-server'
  | 'user';

export interface AuditMetadata {
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  [key: string]: unknown;
}

@Entity('admin_audit_log')
@Index('IDX_admin_audit_log_admin_created_at', ['adminId', 'createdAt'])
@Index('IDX_admin_audit_log_target_type_id', ['targetType', 'targetId'])
@Index('IDX_admin_audit_log_action_created_at', ['action', 'createdAt'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * ID of the admin performing the action (API key ID or user ID)
   */
  @Column({ type: 'varchar', length: 64 })
  @Index('IDX_admin_audit_log_admin_id')
  adminId!: string;

  /**
   * The action being performed
   */
  @Column({ type: 'varchar', length: 50 })
  @Index('IDX_admin_audit_log_action')
  action!: AdminAction;

  /**
   * Type of the target entity
   */
  @Column({ type: 'varchar', length: 50 })
  targetType!: TargetType;

  /**
   * ID of the target entity
   */
  @Column({ type: 'varchar', length: 64 })
  targetId!: string;

  /**
   * Solution ID context (for multi-tenant filtering)
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index('IDX_admin_audit_log_solution_id')
  solutionId!: string | null;

  /**
   * Additional metadata about the action
   */
  @Column({ type: 'simple-json', nullable: true })
  metadata!: AuditMetadata | null;

  /**
   * Whether the action was successful
   */
  @Column({ type: 'boolean', default: true })
  success!: boolean;

  /**
   * Error message if action failed
   */
  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
