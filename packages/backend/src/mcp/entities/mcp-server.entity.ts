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
import { Solution } from '../../solutions/entities/solution.entity';
import type {
  McpServerType,
  McpServerStatus,
  McpHealthStatus,
  McpServerConfig,
  McpTool,
} from '../types';

@Entity('mcp_servers')
@Index('IDX_mcp_servers_tenant_slug', ['solutionId', 'slug'], { unique: true })
@Index('IDX_mcp_servers_tenant_status', ['solutionId', 'status'])
export class McpServer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  solutionId!: string;

  @ManyToOne(() => Solution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solutionId' })
  tenant?: Solution;

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
