/**
 * MCP Server Controller
 *
 * REST API for MCP server management.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { McpPoolService } from './mcp-pool.service';
import {
  CreateMcpServerDto,
  UpdateMcpServerDto,
  ListMcpServersDto,
} from './dto/mcp-server.dto';
import { SolutionAuthGuard } from '../solutions/solution-auth.guard';
import { CurrentTenant } from '../common/decorators/current-solution.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { McpServer } from './entities/mcp-server.entity';

@ApiTags('mcp')
@Controller('api/v1/mcp-servers')
@UseGuards(ApiKeyGuard, SolutionAuthGuard)
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    @InjectRepository(McpServer)
    private readonly mcpServerRepository: Repository<McpServer>,
    private readonly mcpPoolService: McpPoolService,
  ) {}

  /**
   * List all MCP servers for the tenant
   */
  @Get()
  async findAll(
    @CurrentTenant() solutionId: string,
    @Query() query: ListMcpServersDto,
  ) {
    const { limit = 50, page = 1, type, status, query: searchQuery } = query;
    const skip = (page - 1) * limit;

    const where: any = { solutionId };

    if (type) {
      // Normalize type: 'stdio' -> 'custom'
      where.type = type === 'stdio' ? 'custom' : type;
    }

    if (status) {
      where.status = status;
    }

    if (searchQuery) {
      where.name = Like(`%${searchQuery}%`);
    }

    const [items, total] = await this.mcpServerRepository.findAndCount({
      where,
      take: limit,
      skip,
      order: { createdAt: 'DESC' },
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new MCP server
   */
  @Post()
  async create(
    @CurrentTenant() solutionId: string,
    @Body() dto: CreateMcpServerDto,
  ) {
    this.logger.log(`Creating MCP server: ${dto.name} for tenant ${solutionId}`);

    // Normalize type: 'stdio' -> 'custom'
    const normalizedType = dto.type === 'stdio' ? 'custom' : dto.type;

    const createDto = {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      type: normalizedType as any,
      config: dto.config,
    };

    const saved = await this.mcpPoolService.create(solutionId, createDto);

    this.logger.log(`MCP server ${saved.id} created successfully`);

    return saved;
  }

  /**
   * Get an MCP server by ID or slug
   */
  @Get(':id')
  async findOne(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
  ) {
    const mcpServer = await this.mcpPoolService.findOne(solutionId, id);

    if (!mcpServer) {
      throw new NotFoundException(`MCP server not found: ${id}`);
    }

    return mcpServer;
  }

  /**
   * Update an MCP server
   */
  @Put(':id')
  async update(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMcpServerDto,
  ) {
    this.logger.log(`Updating MCP server: ${id} for tenant ${solutionId}`);

    const updated = await this.mcpPoolService.update(solutionId, id, dto);

    this.logger.log(`MCP server ${id} updated successfully`);

    return updated;
  }

  /**
   * Delete an MCP server
   */
  @Delete(':id')
  async remove(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
  ) {
    this.logger.log(`Deleting MCP server: ${id} for tenant ${solutionId}`);

    await this.mcpPoolService.delete(solutionId, id);

    this.logger.log(`MCP server ${id} deleted successfully`);

    return { success: true };
  }

  /**
   * Health check for an MCP server
   */
  @Post(':id/health')
  async healthCheck(
    @CurrentTenant() solutionId: string,
    @Param('id') id: string,
  ) {
    try {
      const health = await this.mcpPoolService.checkHealth(solutionId, id);
      return {
        serverId: id,
        health,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Health check failed for ${id}:`, error);
      throw new NotFoundException(`MCP server ${id} is not running or not found`);
    }
  }
}
