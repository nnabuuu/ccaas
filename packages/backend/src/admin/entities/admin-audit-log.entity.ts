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
  | 'tenant.create'
  | 'tenant.update'
  | 'alert.create'
  | 'alert.update'
  | 'alert.delete'
  | 'sessionTemplate.create'
  | 'sessionTemplate.update'
  | 'sessionTemplate.delete'
  | 'sessionTemplate.sync';

export type TargetType =
  | 'skill'
  | 'session'
  | 'apikey'
  | 'tenant'
  | 'alert';

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
   * Tenant ID context (for multi-tenant filtering)
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index('IDX_admin_audit_log_tenant_id')
  tenantId!: string | null;

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
