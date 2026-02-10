/**
 * Tenants Controller
 *
 * REST API for tenant management (admin only).
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
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';

@Controller('api/v1/tenants')
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
   */
  @Post()
  async create(@Body() dto: CreateTenantDto) {
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
