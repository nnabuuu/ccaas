/**
 * Admin Tenants Controller
 *
 * Admin API for tenant management under unified /api/v1/admin path.
 */

import {
  Controller,
  Get,
  Param,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Auth } from '../../auth/decorators';
import { TenantsService } from '../../tenants/tenants.service';

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Slug pattern (alphanumeric, hyphens, underscores)
const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]*$/i;

@Controller('api/v1/admin/tenants')
@Auth('admin')
export class AdminTenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * GET /api/v1/admin/tenants
   *
   * List all tenants
   */
  @Get()
  async findAll() {
    return this.tenantsService.findAll();
  }

  /**
   * GET /api/v1/admin/tenants/:id
   *
   * Get a tenant by ID (UUID) or slug
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    // Validate input format
    if (!id || id.length > 100) {
      throw new BadRequestException('Invalid tenant identifier');
    }

    // Must be either a valid UUID or a valid slug
    if (!UUID_REGEX.test(id) && !SLUG_REGEX.test(id)) {
      throw new BadRequestException('Invalid tenant identifier format');
    }

    const tenant = await this.tenantsService.findOne(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${id}`);
    }
    return tenant;
  }
}
