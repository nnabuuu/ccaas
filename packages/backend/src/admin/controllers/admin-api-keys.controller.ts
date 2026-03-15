/**
 * Admin API Keys Controller
 *
 * Admin API for API key management under unified /api/v1/admin path.
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
import { AuthAdminOrBuilder, Ctx } from '../../auth/decorators';
import { AdminTenantAccessGuard, isAdminScope } from '../guards/admin-tenant-access.guard';
import { RequestContext } from '../../auth/types';
import { ApiKeyService } from '../../auth/api-key.service';
import { TenantsService } from '../../tenants/tenants.service';
import { AuditService } from '../services/audit.service';
import { CreateApiKeyAdminDto } from '../dto/create-api-key-admin.dto';
import {
  UpdateApiKeyDto,
  CreateApiKeyResponse,
  ApiKeyResponse,
} from '../../auth/dto/api-key.dto';

// UUID regex pattern
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('api/v1/admin/api-keys')
@AuthAdminOrBuilder()
@UseGuards(AdminTenantAccessGuard)
export class AdminApiKeysController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly tenantsService: TenantsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /api/v1/admin/api-keys
   *
   * List API keys for a tenant with pagination
   */
  @Get()
  async findAll(
    @Query('tenantId') tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ): Promise<{
    items: ApiKeyResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Validate tenantId is required
    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required');
    }

    // Validate tenant exists
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    // Parse and validate pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    // Get all keys for tenant
    const allKeys = await this.apiKeyService.findByTenantId(tenant.id);

    // Apply pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const items = allKeys.slice(startIndex, endIndex);

    return {
      items,
      total: allKeys.length,
      page: pageNum,
      limit: limitNum,
    };
  }

  /**
   * GET /api/v1/admin/api-keys/:id
   *
   * Get a single API key by ID
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ): Promise<ApiKeyResponse> {
    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid API key ID format');
    }

    const apiKey = await this.apiKeyService.findById(id);
    if (!apiKey) {
      throw new NotFoundException(`API key not found: ${id}`);
    }

    // Builder keys: verify tenant ownership
    if (!isAdminScope(ctx) && apiKey.tenantId !== ctx.tenantId) {
      throw new ForbiddenException('Access denied to this API key');
    }

    return apiKey;
  }

  /**
   * POST /api/v1/admin/api-keys
   *
   * Create a new API key
   * ⚠️ CRITICAL: Returns raw key ONLY in this response
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateApiKeyAdminDto,
    @Ctx() ctx: RequestContext,
  ): Promise<CreateApiKeyResponse & { warning: string }> {
    // Validate tenant exists
    const tenant = await this.tenantsService.findOne(dto.tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${dto.tenantId}`);
    }

    // Create the API key
    const result = await this.apiKeyService.create(tenant.id, dto);

    // Audit log (NEVER log raw key or hash)
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'apikey.create',
      targetType: 'apikey',
      targetId: result.apiKey.id,
      tenantId: tenant.id,
      metadata: {
        name: dto.name,
        keyPrefix: result.apiKey.keyPrefix,
        scopes: result.apiKey.scopes,
        rateLimitRpm: result.apiKey.rateLimitRpm,
        rateLimitRpd: result.apiKey.rateLimitRpd,
      },
    });

    return {
      ...result,
      warning:
        'This is the only time the raw API key will be displayed. Please save it securely.',
    };
  }

  /**
   * PUT /api/v1/admin/api-keys/:id
   *
   * Update an API key
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
    @Ctx() ctx: RequestContext,
  ): Promise<ApiKeyResponse> {
    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid API key ID format');
    }

    // Get current state for audit
    const previous = await this.apiKeyService.findById(id);
    if (!previous) {
      throw new NotFoundException(`API key not found: ${id}`);
    }

    // Builder keys: verify tenant ownership
    if (!isAdminScope(ctx) && previous.tenantId !== ctx.tenantId) {
      throw new ForbiddenException('Access denied to this API key');
    }

    // Update the API key
    const updated = await this.apiKeyService.update(id, dto);

    // Audit log with before/after values
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'apikey.update',
      targetType: 'apikey',
      targetId: id,
      tenantId: previous.tenantId,
      metadata: {
        previousValue: {
          name: previous.name,
          scopes: previous.scopes,
          rateLimitRpm: previous.rateLimitRpm,
          rateLimitRpd: previous.rateLimitRpd,
          status: previous.status,
          expiresAt: previous.expiresAt,
        },
        newValue: {
          name: updated.name,
          scopes: updated.scopes,
          rateLimitRpm: updated.rateLimitRpm,
          rateLimitRpd: updated.rateLimitRpd,
          status: updated.status,
          expiresAt: updated.expiresAt,
        },
      },
    });

    return updated;
  }

  /**
   * POST /api/v1/admin/api-keys/:id/revoke
   *
   * Revoke an API key
   */
  @Post(':id/revoke')
  async revoke(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ): Promise<ApiKeyResponse> {
    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid API key ID format');
    }

    // Validate key exists and is not already revoked
    const existing = await this.apiKeyService.findById(id);
    if (!existing) {
      throw new NotFoundException(`API key not found: ${id}`);
    }

    // Builder keys: verify tenant ownership
    if (!isAdminScope(ctx) && existing.tenantId !== ctx.tenantId) {
      throw new ForbiddenException('Access denied to this API key');
    }

    if (existing.status === 'revoked') {
      throw new BadRequestException('API key is already revoked');
    }

    // Revoke the key
    await this.apiKeyService.revoke(id);
    const revoked = await this.apiKeyService.findById(id);

    // Audit log
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'apikey.revoke',
      targetType: 'apikey',
      targetId: id,
      tenantId: existing.tenantId,
      metadata: {
        keyPrefix: existing.keyPrefix,
        name: existing.name,
      },
    });

    return revoked!;
  }

  /**
   * DELETE /api/v1/admin/api-keys/:id
   *
   * Delete an API key permanently
   */
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ): Promise<{ success: boolean; message: string }> {
    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid API key ID format');
    }

    // Get key info for audit (BEFORE deletion)
    const existing = await this.apiKeyService.findById(id);
    if (!existing) {
      throw new NotFoundException(`API key not found: ${id}`);
    }

    // Builder keys: verify tenant ownership
    if (!isAdminScope(ctx) && existing.tenantId !== ctx.tenantId) {
      throw new ForbiddenException('Access denied to this API key');
    }

    // Audit log BEFORE deletion
    await this.auditService.log({
      adminId: ctx?.apiKeyId || 'system',
      action: 'apikey.delete',
      targetType: 'apikey',
      targetId: id,
      tenantId: existing.tenantId,
      metadata: {
        keyPrefix: existing.keyPrefix,
        name: existing.name,
        scopes: existing.scopes,
      },
    });

    // Delete the key
    await this.apiKeyService.delete(id);

    return {
      success: true,
      message: `API key ${existing.keyPrefix}... deleted successfully`,
    };
  }
}
