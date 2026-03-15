/**
 * Builder API Keys Controller
 *
 * Allows builder-scoped API keys to create and manage API keys
 * for tenants they own. Cannot create admin or builder scoped keys.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth, Ctx } from '../auth/decorators';
import { RequestContext } from '../auth/types';
import { ApiKeyService } from '../auth/api-key.service';
import { TenantsService } from '../tenants/tenants.service';
import { UserTenantService } from '../users/user-tenant.service';
import { AuditService } from '../admin/services/audit.service';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  CreateApiKeyResponse,
  ApiKeyResponse,
} from '../auth/dto/api-key.dto';
import { requireBuilderUserId, verifyBuilderTenantOwnership } from './builder.helpers';

const FORBIDDEN_SCOPES = ['admin', 'builder'] as const;

@ApiTags('builder')
@Controller('api/v1/builder')
@Auth('builder')
export class BuilderApiKeysController {
  private readonly logger = new Logger(BuilderApiKeysController.name);

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly tenantsService: TenantsService,
    private readonly userTenantService: UserTenantService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * POST /api/v1/builder/tenants/:tenantId/api-keys
   *
   * Create an API key for an owned tenant (no admin/builder scope allowed).
   */
  @Post('tenants/:tenantId/api-keys')
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateApiKeyDto,
    @Ctx() ctx: RequestContext,
  ): Promise<CreateApiKeyResponse & { warning: string }> {
    const userId = requireBuilderUserId(ctx);
    await verifyBuilderTenantOwnership(userId, tenantId, this.tenantsService, this.userTenantService);

    // Prevent privilege escalation
    this.validateNoPrivilegedScopes(dto.scopes);

    // Builder child keys must not inherit userId
    dto.userId = undefined;

    const result = await this.apiKeyService.create(tenantId, dto);

    await this.auditService.log({
      adminId: ctx.apiKeyId || userId,
      action: 'apikey.create',
      targetType: 'apikey',
      targetId: result.apiKey.id,
      tenantId,
      metadata: {
        name: dto.name,
        keyPrefix: result.apiKey.keyPrefix,
        scopes: result.apiKey.scopes,
        builderUserId: userId,
      },
    });

    return {
      ...result,
      warning:
        'This is the only time the raw API key will be displayed. Please save it securely.',
    };
  }

  /**
   * GET /api/v1/builder/tenants/:tenantId/api-keys
   *
   * List API keys for an owned tenant.
   */
  @Get('tenants/:tenantId/api-keys')
  async findAll(
    @Param('tenantId') tenantId: string,
    @Ctx() ctx: RequestContext,
  ): Promise<ApiKeyResponse[]> {
    const userId = requireBuilderUserId(ctx);
    await verifyBuilderTenantOwnership(userId, tenantId, this.tenantsService, this.userTenantService);

    return this.apiKeyService.findByTenantId(tenantId);
  }

  /**
   * PUT /api/v1/builder/api-keys/:id
   *
   * Update an API key (verify tenant ownership).
   */
  @Put('api-keys/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
    @Ctx() ctx: RequestContext,
  ): Promise<ApiKeyResponse> {
    const userId = requireBuilderUserId(ctx);
    const existing = await this.findKeyAndVerifyOwnership(userId, id);

    // Prevent privilege escalation
    this.validateNoPrivilegedScopes(dto.scopes);

    const updated = await this.apiKeyService.update(id, dto);

    await this.auditService.log({
      adminId: ctx.apiKeyId || userId,
      action: 'apikey.update',
      targetType: 'apikey',
      targetId: id,
      tenantId: existing.tenantId,
      metadata: {
        builderUserId: userId,
        previousValue: { name: existing.name, scopes: existing.scopes },
        newValue: { name: updated.name, scopes: updated.scopes },
      },
    });

    return updated;
  }

  /**
   * POST /api/v1/builder/api-keys/:id/revoke
   *
   * Revoke an API key (verify tenant ownership).
   */
  @Post('api-keys/:id/revoke')
  async revoke(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ): Promise<ApiKeyResponse> {
    const userId = requireBuilderUserId(ctx);
    const existing = await this.findKeyAndVerifyOwnership(userId, id);

    if (existing.status === 'revoked') {
      throw new BadRequestException('API key is already revoked');
    }

    await this.apiKeyService.revoke(id);
    const revoked = await this.apiKeyService.findById(id);
    if (!revoked) {
      throw new NotFoundException(`API key not found after revocation: ${id}`);
    }

    await this.auditService.log({
      adminId: ctx.apiKeyId || userId,
      action: 'apikey.revoke',
      targetType: 'apikey',
      targetId: id,
      tenantId: existing.tenantId,
      metadata: {
        keyPrefix: existing.keyPrefix,
        name: existing.name,
        builderUserId: userId,
      },
    });

    return revoked;
  }

  /**
   * DELETE /api/v1/builder/api-keys/:id
   *
   * Delete an API key (verify tenant ownership).
   */
  @Delete('api-keys/:id')
  async delete(
    @Param('id') id: string,
    @Ctx() ctx: RequestContext,
  ): Promise<{ success: boolean; message: string }> {
    const userId = requireBuilderUserId(ctx);
    const existing = await this.findKeyAndVerifyOwnership(userId, id);

    await this.auditService.log({
      adminId: ctx.apiKeyId || userId,
      action: 'apikey.delete',
      targetType: 'apikey',
      targetId: id,
      tenantId: existing.tenantId,
      metadata: {
        keyPrefix: existing.keyPrefix,
        name: existing.name,
        builderUserId: userId,
      },
    });

    await this.apiKeyService.delete(id);

    return {
      success: true,
      message: `API key ${existing.keyPrefix}... deleted successfully`,
    };
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private async findKeyAndVerifyOwnership(
    userId: string,
    keyId: string,
  ): Promise<ApiKeyResponse> {
    const existing = await this.apiKeyService.findById(keyId);
    if (!existing) {
      throw new NotFoundException(`API key not found: ${keyId}`);
    }

    await verifyBuilderTenantOwnership(userId, existing.tenantId, this.tenantsService, this.userTenantService);
    return existing;
  }

  private validateNoPrivilegedScopes(scopes?: string[]): void {
    if (!scopes) return;
    const forbidden = scopes.filter((s) =>
      FORBIDDEN_SCOPES.includes(s as (typeof FORBIDDEN_SCOPES)[number]),
    );
    if (forbidden.length > 0) {
      throw new ForbiddenException(
        `Builder cannot create keys with scopes: ${forbidden.join(', ')}`,
      );
    }
  }
}
