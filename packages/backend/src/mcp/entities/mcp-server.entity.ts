/**
 * MCP Server Entity
 *
 * Represents an MCP server configuration for a tenant.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import type {
  McpServerType,
  McpServerStatus,
  McpHealthStatus,
  McpServerConfig,
  McpTool,
} from '../types';

@Entity('mcp_servers')
@Index('IDX_mcp_servers_tenant_slug', ['tenantId', 'slug'], { unique: true })
@Index('IDX_mcp_servers_tenant_status', ['tenantId', 'status'])
export class McpServer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant?: Tenant;

  @Column()
  name!: string;

  @Column()
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20 })
  type!: McpServerType;

  @Column({ type: 'simple-json' })
  config!: McpServerConfig;

  @Column({ type: 'simple-json', default: '[]' })
  tools!: McpTool[];

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: McpServerStatus;

  @Column({ type: 'datetime', nullable: true })
  lastHealthCheck!: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'unknown' })
  healthStatus!: McpHealthStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
