/**
 * Admin MCP Servers Controller
 *
 * Cross-tenant MCP server management for admins.
 * Routes: /api/v1/admin/mcp-servers
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { AuthAdminOrBuilder, Ctx } from '../../auth/decorators';
import { AdminTenantAccessGuard, isAdminScope } from '../guards/admin-tenant-access.guard';
import { RequestContext } from '../../auth/types';
import { McpPoolService } from '../../mcp/mcp-pool.service';
import type { CreateMcpServerDto as ServiceCreateDto } from '../../mcp/mcp-pool.service';
import { TenantsService } from '../../tenants/tenants.service';
import { AuditService } from '../services/audit.service';
import { EventMapperService } from '../../sessions/event-mapper.service';
import { CreateMcpServerDto, UpdateMcpServerDto } from '../../mcp/dto/mcp-server.dto';
import { McpServer } from '../../mcp/entities/mcp-server.entity';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Body DTO for admin create — extends CreateMcpServerDto with required tenantId
 */
class AdminCreateMcpServerBody extends CreateMcpServerDto {
  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

@ApiTags('admin')
@Controller('api/v1/admin/mcp-servers')
@AuthAdminOrBuilder()
@UseGuards(AdminTenantAccessGuard)
export class AdminMcpServersController {
  constructor(
    private readonly mcpPool: McpPoolService,
    private readonly tenants: TenantsService,
    private readonly audit: AuditService,
    private readonly eventMapper: EventMapperService,
  ) {}

  /**
   * GET /api/v1/admin/mcp-servers
   *
   * List ALL MCP servers for a tenant (including disabled) with pagination.
   * tenantId is a required query parameter.
   */
  @Get()
  async findAll(
    @Query('tenantId') tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ): Promise<{ items: McpServer[]; total: number; page: number; limit: number }> {
    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required');
    }

    const tenant = await this.tenants.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    // Use DB-backed method to include disabled/errored servers
    const allServers = await this.mcpPool.findAllByTenantId(tenantId);
    const startIndex = (pageNum - 1) * limitNum;
    const items = allServers.slice(startIndex, startIndex + limitNum);

    return { items, total: allServers.length, page: pageNum, limit: limitNum };
  }

  /**
   * POST /api/v1/admin/mcp-servers
   *
   * Create a new MCP server for a tenant.
   * tenantId must be included in the request body.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: AdminCreateMcpServerBody,
    @Ctx() ctx: RequestContext,
  ): Promise<McpServer> {
    const adminId = ctx?.apiKeyId || 'system';

    const tenant = await this.tenants.findOne(dto.tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${dto.tenantId}`);
    }

    const { tenantId, ...createDto } = dto;
    const server = await this.mcpPool.create(tenantId, createDto as ServiceCreateDto);

    await this.audit.logSuccess(
      adminId,
      'mcp.create',
      'mcp-server',
      server.id,
      { name: server.name, tenantId },
      tenantId,
    );

    return server;
  }

  /**
   * GET /api/v1/admin/mcp-servers/:id
   *
   * Get a single MCP server by ID (no tenant restriction).
   * Falls back to DB for disabled/inactive servers.
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ): Promise<McpServer> {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid MCP server ID format');
    }

    const server = await this.mcpPool.findById(id);
    if (!server) {
      throw new NotFoundException(`MCP server not found: ${id}`);
    }

    // Builder keys: verify tenant ownership
    if (!isAdminScope(ctx) && server.tenantId !== ctx.tenantId) {
      throw new ForbiddenException('Access denied to this MCP server');
    }

    return server;
  }

  /**
   * PUT /api/v1/admin/mcp-servers/:id
   *
   * Update an MCP server.
   * If config is updated, syncs toolEventTriggers into EventMapperService immediately.
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMcpServerDto,
    @Ctx() ctx: RequestContext,
  ): Promise<McpServer> {
    const adminId = ctx?.apiKeyId || 'system';

    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid MCP server ID format');
    }

    const existing = await this.mcpPool.findById(id);
    if (!existing) {
      throw new NotFoundException(`MCP server not found: ${id}`);
    }

    // Builder keys: verify tenant ownership
    if (!isAdminScope(ctx) && existing.tenantId !== ctx.tenantId) {
      throw new ForbiddenException('Access denied to this MCP server');
    }

    const updated = await this.mcpPool.update(existing.tenantId, id, dto);

    // Sync toolEventTriggers into EventMapperService memory registry immediately.
    // Uses active-only findByTenantId — disabled servers' triggers should not fire.
    if (dto.config) {
      const activeServers = await this.mcpPool.findByTenantId(existing.tenantId);
      const triggers = activeServers.flatMap(s => s.config?.toolEventTriggers ?? []);
      this.eventMapper.registerTenantToolTriggers(existing.tenantId, triggers);
    }

    await this.audit.logSuccess(
      adminId,
      'mcp.update',
      'mcp-server',
      id,
      { name: updated.name, tenantId: existing.tenantId },
      existing.tenantId,
    );

    return updated;
  }

  /**
   * DELETE /api/v1/admin/mcp-servers/:id
   *
   * Delete an MCP server and re-syncs toolEventTriggers.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ): Promise<void> {
    const adminId = ctx?.apiKeyId || 'system';

    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid MCP server ID format');
    }

    const server = await this.mcpPool.findById(id);
    if (!server) {
      throw new NotFoundException(`MCP server not found: ${id}`);
    }

    // Builder keys: verify tenant ownership
    if (!isAdminScope(ctx) && server.tenantId !== ctx.tenantId) {
      throw new ForbiddenException('Access denied to this MCP server');
    }

    const { tenantId, name } = server;

    try {
      await this.mcpPool.delete(tenantId, id);
    } catch (err) {
      await this.audit.logFailure(
        adminId,
        'mcp.delete',
        'mcp-server',
        id,
        err instanceof Error ? err.message : 'Unknown error',
        { name, tenantId },
        tenantId,
      );
      throw err;
    }

    // Remove deleted server's triggers from the in-memory registry
    const remainingServers = await this.mcpPool.findByTenantId(tenantId);
    const triggers = remainingServers.flatMap(s => s.config?.toolEventTriggers ?? []);
    this.eventMapper.registerTenantToolTriggers(tenantId, triggers);

    await this.audit.logSuccess(
      adminId,
      'mcp.delete',
      'mcp-server',
      id,
      { name, tenantId },
      tenantId,
    );
  }
}
