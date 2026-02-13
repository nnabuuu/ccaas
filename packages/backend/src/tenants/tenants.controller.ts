/**
 * Tenants Controller
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
import { Auth } from '../auth/decorators';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto, CreateTenantResponse } from './dto/tenant.dto';

@Controller('api/v1/tenants')
@Auth('admin')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

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
      throw new NotFoundException(`Tenant not found: ${id}`);
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
