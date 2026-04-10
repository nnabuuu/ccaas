/**
 * MCP Pool Service
 *
 * Manages MCP server instances, health checking, and tool execution.
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
} from '@nestjs/common';
import { AlreadyExistsException } from '../protocol/http-exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { McpServer } from './entities/mcp-server.entity';
import { RestAdapterService, RestApiAdapter } from './rest-adapter.service';
import type {
  McpServerConfig,
  McpServerType,
  McpHealthStatus,
  McpTool,
  ToolExecutionResult,
  HealthCheckResult,
} from './types';

// ==========================================================================
// TYPES
// ==========================================================================

interface McpServerEntry {
  server: McpServer;
  adapter?: RestApiAdapter;
  lastHealthCheck?: Date;
  healthStatus: McpHealthStatus;
}

export interface CreateMcpServerDto {
  name: string;
  slug?: string;
  description?: string;
  type: McpServerType;
  config: McpServerConfig;
}

export interface UpdateMcpServerDto {
  name?: string;
  description?: string;
  config?: McpServerConfig;
  status?: 'active' | 'disabled';
}

// ==========================================================================
// MCP POOL SERVICE
// ==========================================================================

@Injectable()
export class McpPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpPoolService.name);
  private servers: Map<string, McpServerEntry> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly healthCheckIntervalMs: number;

  constructor(
    @InjectRepository(McpServer)
    private readonly mcpServerRepository: Repository<McpServer>,
    private readonly restAdapterService: RestAdapterService,
    private readonly configService: ConfigService,
  ) {
    this.healthCheckIntervalMs = this.configService.get(
      'mcp.healthCheckIntervalMs',
      60000,
    );
  }

  async onModuleInit() {
    await this.loadServers();

    if (this.healthCheckIntervalMs > 0) {
      this.startHealthChecks();
    }

    this.logger.log(`Initialized with ${this.servers.size} MCP servers`);
  }

  onModuleDestroy() {
    this.shutdown();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  private async loadServers(): Promise<void> {
    const servers = await this.mcpServerRepository.find({
      where: { status: 'active' },
    });

    for (const server of servers) {
      const entry = this.createEntry(server);
      this.servers.set(server.id, entry);
    }
  }

  private createEntry(server: McpServer): McpServerEntry {
    const entry: McpServerEntry = {
      server,
      healthStatus: 'unknown',
    };

    // Create REST adapter if applicable
    if (server.type === 'rest-adapter' && server.config.restAdapter) {
      try {
        entry.adapter = this.restAdapterService.createAdapter(
          server.config.restAdapter,
        );
        server.tools = entry.adapter.generateTools();
      } catch (error) {
        this.logger.error(
          `Failed to create REST adapter for ${server.name}: ${error}`,
        );
        entry.healthStatus = 'unhealthy';
      }
    }

    return entry;
  }

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Create a new MCP server
   */
  async create(tenantId: string, dto: CreateMcpServerDto): Promise<McpServer> {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check for duplicate
    const existing = await this.findBySlug(tenantId, slug);
    if (existing) {
      throw new AlreadyExistsException(`MCP server with slug '${slug}' already exists`);
    }

    const server = this.mcpServerRepository.create({
      id: crypto.randomUUID(),
      tenantId,
      name: dto.name,
      slug,
      description: dto.description || null,
      type: dto.type,
      config: dto.config,
      tools: [],
      status: 'active',
      healthStatus: 'unknown',
    });

    // Create entry with adapter
    const entry = this.createEntry(server);

    // Test connection for REST adapters
    if (entry.adapter) {
      const testResult = await entry.adapter.testConnection();
      entry.healthStatus = testResult.success ? 'healthy' : 'unhealthy';
      server.healthStatus = entry.healthStatus;
      server.lastHealthCheck = new Date();
    }

    // Save to database
    const saved = await this.mcpServerRepository.save(server);

    // Add to in-memory cache
    this.servers.set(saved.id, entry);

    this.logger.log(`Created MCP server: ${server.name} (${server.id})`);

    return saved;
  }

  /**
   * Get an MCP server by ID or slug
   */
  async findOne(tenantId: string, idOrSlug: string): Promise<McpServer | null> {
    // Try by ID from cache first
    const byId = this.servers.get(idOrSlug);
    if (byId && byId.server.tenantId === tenantId) {
      return byId.server;
    }

    // Try by slug
    return this.findBySlug(tenantId, idOrSlug);
  }

  /**
   * Update an MCP server
   */
  async update(
    tenantId: string,
    idOrSlug: string,
    dto: UpdateMcpServerDto,
  ): Promise<McpServer> {
    const server = await this.findOne(tenantId, idOrSlug);
    if (!server) {
      throw new NotFoundException(`MCP server not found: ${idOrSlug}`);
    }

    const entry = this.servers.get(server.id)!;

    // Update fields
    if (dto.name !== undefined) server.name = dto.name;
    if (dto.description !== undefined) server.description = dto.description;
    if (dto.status !== undefined) server.status = dto.status;
    if (dto.config !== undefined) {
      server.config = { ...server.config, ...dto.config };

      // Recreate adapter if REST config changed
      if (server.type === 'rest-adapter' && server.config.restAdapter) {
        entry.adapter = this.restAdapterService.createAdapter(
          server.config.restAdapter,
        );
        server.tools = entry.adapter.generateTools();
      }
    }

    const saved = await this.mcpServerRepository.save(server);
    entry.server = saved;

    this.logger.log(`Updated MCP server: ${server.name}`);

    return saved;
  }

  /**
   * Delete an MCP server
   */
  async delete(tenantId: string, idOrSlug: string): Promise<void> {
    const server = await this.findOne(tenantId, idOrSlug);
    if (!server) {
      throw new NotFoundException(`MCP server not found: ${idOrSlug}`);
    }

    await this.mcpServerRepository.delete(server.id);
    this.servers.delete(server.id);

    this.logger.log(`Deleted MCP server: ${server.name}`);
  }

  /**
   * Get an MCP server by ID without tenant restriction (admin use).
   * Checks in-memory cache first, falls back to DB for inactive/disabled servers.
   */
  async findById(id: string): Promise<McpServer | null> {
    const cached = this.servers.get(id)?.server;
    if (cached) return cached;
    return this.mcpServerRepository.findOne({ where: { id } });
  }

  /**
   * List ALL MCP servers for a tenant regardless of status (admin use).
   * Queries the database directly — includes disabled/errored servers.
   */
  async findAllByTenantId(tenantId: string): Promise<McpServer[]> {
    return this.mcpServerRepository.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });
  }

  /**
   * List all MCP servers for a tenant
   */
  async findByTenantId(tenantId: string): Promise<McpServer[]> {
    const servers: McpServer[] = [];
    for (const entry of this.servers.values()) {
      if (entry.server.tenantId === tenantId) {
        servers.push(entry.server);
      }
    }
    return servers.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ==========================================================================
  // TOOL OPERATIONS
  // ==========================================================================

  /**
   * Get available tools for a session
   */
  async getToolsForSession(
    tenantId: string,
    mcpServerIds?: string[],
  ): Promise<McpTool[]> {
    const tools: McpTool[] = [];

    for (const entry of this.servers.values()) {
      if (entry.server.tenantId !== tenantId) continue;
      if (entry.server.status !== 'active') continue;
      if (mcpServerIds && !mcpServerIds.includes(entry.server.id)) continue;

      tools.push(...entry.server.tools);
    }

    return tools;
  }

  /**
   * Execute a tool
   */
  async executeTool(
    tenantId: string,
    mcpServerId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const entry = this.servers.get(mcpServerId);
    if (!entry || entry.server.tenantId !== tenantId) {
      return {
        success: false,
        error: `MCP server not found: ${mcpServerId}`,
        duration: 0,
      };
    }

    if (!entry.adapter) {
      return {
        success: false,
        error: 'MCP server does not support tool execution',
        duration: 0,
      };
    }

    return entry.adapter.executeTool(toolName, input);
  }

  // ==========================================================================
  // HEALTH CHECKING
  // ==========================================================================

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(
      () => this.runHealthChecks(),
      this.healthCheckIntervalMs,
    );
  }

  private async runHealthChecks(): Promise<void> {
    for (const [, entry] of this.servers) {
      if (entry.adapter) {
        try {
          const result = await entry.adapter.testConnection();
          entry.healthStatus = result.success ? 'healthy' : 'unhealthy';
          entry.lastHealthCheck = new Date();
          entry.server.healthStatus = entry.healthStatus;
          entry.server.lastHealthCheck = entry.lastHealthCheck;

          // Update in database
          await this.mcpServerRepository.update(entry.server.id, {
            healthStatus: entry.healthStatus,
            lastHealthCheck: entry.lastHealthCheck,
          });
        } catch {
          entry.healthStatus = 'unhealthy';
        }
      }
    }
  }

  /**
   * Check health of a specific MCP server
   */
  async checkHealth(
    tenantId: string,
    idOrSlug: string,
  ): Promise<HealthCheckResult> {
    const server = await this.findOne(tenantId, idOrSlug);
    if (!server) {
      throw new NotFoundException(`MCP server not found: ${idOrSlug}`);
    }

    const entry = this.servers.get(server.id)!;

    if (!entry.adapter) {
      return { status: 'unknown' };
    }

    const result = await entry.adapter.testConnection();
    entry.healthStatus = result.success ? 'healthy' : 'unhealthy';
    entry.lastHealthCheck = new Date();
    entry.server.healthStatus = entry.healthStatus;
    entry.server.lastHealthCheck = entry.lastHealthCheck;

    // Update in database
    await this.mcpServerRepository.update(server.id, {
      healthStatus: entry.healthStatus,
      lastHealthCheck: entry.lastHealthCheck,
    });

    return {
      status: entry.healthStatus,
      lastCheck: entry.lastHealthCheck,
      latencyMs: result.latencyMs,
      message: result.message,
    };
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  getStats(): {
    totalServers: number;
    serversByType: Record<string, number>;
    serversByHealth: Record<string, number>;
  } {
    const serversByType: Record<string, number> = {};
    const serversByHealth: Record<string, number> = {};

    for (const entry of this.servers.values()) {
      serversByType[entry.server.type] =
        (serversByType[entry.server.type] || 0) + 1;
      serversByHealth[entry.healthStatus] =
        (serversByHealth[entry.healthStatus] || 0) + 1;
    }

    return {
      totalServers: this.servers.size,
      serversByType,
      serversByHealth,
    };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async findBySlug(
    tenantId: string,
    slug: string,
  ): Promise<McpServer | null> {
    // Check cache first
    for (const entry of this.servers.values()) {
      if (entry.server.tenantId === tenantId && entry.server.slug === slug) {
        return entry.server;
      }
    }

    // Check database
    return this.mcpServerRepository.findOne({
      where: { tenantId, slug },
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Shutdown the pool
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}
