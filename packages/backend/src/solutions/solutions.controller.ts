/**
 * Solutions Controller
 *
 * REST API for tenant management. All endpoints require admin authentication.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators';
import { SolutionsService } from './solutions.service';
import { CreateTenantDto, UpdateTenantDto, CreateTenantResponse } from './dto/solution.dto';

@ApiTags('solutions')
@Controller('api/v1/solutions')
@Auth('admin')
export class SolutionsController {
  constructor(private readonly tenantsService: SolutionsService) {}

  /**
   * List all tenants
   */
  @Get()
  async findAll() {
    return this.tenantsService.findAll();
  }

  /**
   * Create a new tenant
   *
   * Optionally auto-create an API key by setting autoCreateApiKey: true
   */
  @Post()
  async create(@Body() dto: CreateTenantDto): Promise<CreateTenantResponse> {
    return this.tenantsService.create(dto);
  }

  /**
   * Get a tenant by ID or slug
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const tenant = await this.tenantsService.findOne(id);
    if (!tenant) {
      throw new NotFoundException(`Solution not found: ${id}`);
    }
    return tenant;
  }

  /**
   * Update a tenant
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }
}
