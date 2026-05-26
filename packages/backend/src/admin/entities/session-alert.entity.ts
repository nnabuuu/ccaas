/**
 * Session Alert Entity
 *
 * Configuration for session monitoring alerts.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type AlertType =
  | 'crash'
  | 'long_running'
  | 'error_rate'
  | 'high_token_usage'
  | 'session_limit';

export interface AlertThreshold {
  /**
   * Duration in seconds for long_running alerts
   */
  durationSeconds?: number;

  /**
   * Error rate percentage for error_rate alerts
   */
  errorRatePercent?: number;

  /**
   * Token count for high_token_usage alerts
   */
  tokenCount?: number;

  /**
   * Session count percentage for session_limit alerts
   */
  sessionLimitPercent?: number;

  /**
   * Time window in minutes for rate-based alerts
   */
  timeWindowMinutes?: number;
}

@Entity('session_alerts')
@Index('IDX_session_alerts_tenant_enabled', ['solutionId', 'enabled'])
@Index('IDX_session_alerts_alert_type_enabled', ['alertType', 'enabled'])
export class SessionAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Solution this alert belongs to (null for global alerts)
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index('IDX_session_alerts_tenant_id')
  solutionId!: string | null;

  /**
   * Type of alert
   */
  @Column({ type: 'varchar', length: 50 })
  alertType!: AlertType;

  /**
   * Human-readable name for the alert
   */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /**
   * Description of what this alert monitors
   */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /**
   * Threshold configuration
   */
  @Column({ type: 'simple-json' })
  threshold!: AlertThreshold;

  /**
   * Webhook URL to notify when alert triggers
   */
  @Column({ type: 'text', nullable: true })
  webhookUrl!: string | null;

  /**
   * Email addresses to notify (comma-separated)
   */
  @Column({ type: 'text', nullable: true })
  emailAddresses!: string | null;

  /**
   * Whether the alert is enabled
   */
  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  /**
   * Cooldown period between alerts (in minutes)
   */
  @Column({ type: 'integer', default: 5 })
  cooldownMinutes!: number;

  /**
   * Last time this alert was triggered
   */
  @Column({ type: 'datetime', nullable: true })
  lastTriggeredAt!: Date | null;

  /**
   * Number of times this alert has been triggered
   */
  @Column({ type: 'integer', default: 0 })
  triggerCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
