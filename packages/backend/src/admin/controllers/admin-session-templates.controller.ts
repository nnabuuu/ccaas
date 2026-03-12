/**
 * Admin Session Templates Controller
 *
 * Admin API for managing session templates under /api/v1/admin/tenants/:tenantId/session-templates
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Auth, Ctx } from '../../auth/decorators';
import { RequestContext } from '../../auth/types';
import { TenantsService } from '../../tenants/tenants.service';
import { Tenant, PLAN_MAX_SESSION_TTL_MS } from '../../tenants/entities/tenant.entity';
import { AuditService } from '../services/audit.service';
import {
  CreateSessionTemplateDto,
  UpdateSessionTemplateDto,
  PreviewTemplateDto,
  SessionTemplateBodyDto,
  SyncSessionTemplatesBodyDto,
} from '../dto/session-template.dto';

const MAX_TEMPLATES_PER_TENANT = 50;

@Controller('api/v1/admin/tenants/:tenantId/session-templates')
@ApiTags('Admin - Session Templates')
@Auth('admin')
export class AdminSessionTemplatesController {
  private readonly logger = new Logger(AdminSessionTemplatesController.name);

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findTenantOrThrow(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }
    return tenant;
  }

  private getTemplates(tenant: Tenant): Record<string, SessionTemplateBodyDto> {
    return { ...(tenant.config.sessionTemplates || {}) };
  }

  private getTemplateOrThrow(
    templates: Record<string, SessionTemplateBodyDto>,
    name: string,
  ): SessionTemplateBodyDto {
    if (!templates[name]) {
      const available = Object.keys(templates);
      throw new NotFoundException(
        `Session template "${name}" not found. Available: ${available.join(', ') || 'none'}`,
      );
    }
    return templates[name];
  }

  private getAdminId(ctx: RequestContext): string {
    return ctx?.apiKeyId || 'system';
  }

  private capTemplateTtl(
    template: SessionTemplateBodyDto,
    tenant: Tenant,
  ): SessionTemplateBodyDto {
    if (template.sessionTtlMs === undefined) return template;
    const max = PLAN_MAX_SESSION_TTL_MS[tenant.plan];
    if (template.sessionTtlMs > max) {
      this.logger.warn(
        `Template sessionTtlMs ${template.sessionTtlMs} exceeds plan max ${max} for tenant ${tenant.id} (${tenant.plan}), capping`,
      );
      return { ...template, sessionTtlMs: max };
    }
    return template;
  }

  private async tryLogAudit(
    params: Parameters<AuditService['log']>[0],
  ): Promise<void> {
    try {
      await this.auditService.log(params);
    } catch (err) {
      this.logger.error(`Failed to log audit event: ${params.action}`, err);
    }
  }

  // ---------------------------------------------------------------------------
  // Endpoints
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/admin/tenants/:tenantId/session-templates
   *
   * List all session templates for a tenant
   */
  @Get()
  @ApiOperation({ summary: 'List all session templates for a tenant' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  async listTemplates(@Param('tenantId') tenantId: string) {
    const tenant = await this.findTenantOrThrow(tenantId);

    return {
      templates: tenant.config.sessionTemplates || {},
      defaultTemplate: tenant.config.defaultSessionTemplate,
    };
  }

  /**
   * GET /api/v1/admin/tenants/:tenantId/session-templates/:name
   *
   * Get a specific session template
   */
  @Get(':name')
  @ApiOperation({ summary: 'Get a specific session template' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'name', description: 'Template name' })
  async getTemplate(
    @Param('tenantId') tenantId: string,
    @Param('name') name: string,
  ) {
    const tenant = await this.findTenantOrThrow(tenantId);
    const templates = this.getTemplates(tenant);
    const template = this.getTemplateOrThrow(templates, name);

    return { name, template };
  }

  /**
   * POST /api/v1/admin/tenants/:tenantId/session-templates
   *
   * Create a new session template
   */
  @Post()
  @ApiOperation({ summary: 'Create a new session template' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  async createTemplate(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateSessionTemplateDto,
    @Ctx() ctx: RequestContext,
  ) {
    const tenant = await this.findTenantOrThrow(tenantId);
    const templates = this.getTemplates(tenant);

    if (templates[dto.name]) {
      throw new ConflictException(
        `Session template "${dto.name}" already exists`,
      );
    }

    if (Object.keys(templates).length >= MAX_TEMPLATES_PER_TENANT) {
      throw new BadRequestException(
        `Tenant has reached the maximum of ${MAX_TEMPLATES_PER_TENANT} session templates`,
      );
    }

    const cappedTemplate = this.capTemplateTtl(dto.template, tenant);
    templates[dto.name] = cappedTemplate;
    await this.tenantsService.update(tenantId, {
      config: { ...tenant.config, sessionTemplates: templates },
    });

    await this.tryLogAudit({
      adminId: this.getAdminId(ctx),
      action: 'sessionTemplate.create',
      targetType: 'tenant',
      targetId: tenant.id,
      tenantId: tenant.id,
      metadata: { templateName: dto.name, template: dto.template },
    });

    return { name: dto.name, template: cappedTemplate };
  }

  /**
   * PUT /api/v1/admin/tenants/:tenantId/session-templates/:name
   *
   * Update an existing session template
   */
  @Put(':name')
  @ApiOperation({ summary: 'Update an existing session template' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'name', description: 'Template name' })
  async updateTemplate(
    @Param('tenantId') tenantId: string,
    @Param('name') name: string,
    @Body() dto: UpdateSessionTemplateDto,
    @Ctx() ctx: RequestContext,
  ) {
    const tenant = await this.findTenantOrThrow(tenantId);
    const templates = this.getTemplates(tenant);
    const previousTemplate = this.getTemplateOrThrow(templates, name);

    const cappedTemplate = this.capTemplateTtl(dto.template, tenant);
    templates[name] = cappedTemplate;
    await this.tenantsService.update(tenantId, {
      config: { ...tenant.config, sessionTemplates: templates },
    });

    await this.tryLogAudit({
      adminId: this.getAdminId(ctx),
      action: 'sessionTemplate.update',
      targetType: 'tenant',
      targetId: tenant.id,
      tenantId: tenant.id,
      metadata: { templateName: name, previousValue: previousTemplate, newValue: dto.template },
    });

    return { name, template: cappedTemplate };
  }

  /**
   * DELETE /api/v1/admin/tenants/:tenantId/session-templates/:name
   *
   * Delete a session template
   */
  @Delete(':name')
  @ApiOperation({ summary: 'Delete a session template' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'name', description: 'Template name' })
  async deleteTemplate(
    @Param('tenantId') tenantId: string,
    @Param('name') name: string,
    @Ctx() ctx: RequestContext,
  ) {
    const tenant = await this.findTenantOrThrow(tenantId);
    const templates = this.getTemplates(tenant);
    const deletedTemplate = this.getTemplateOrThrow(templates, name);

    delete templates[name];

    const updatedConfig = { ...tenant.config, sessionTemplates: templates };
    // Clear the default template reference if it pointed to the deleted template
    if (updatedConfig.defaultSessionTemplate === name) {
      delete updatedConfig.defaultSessionTemplate;
    }

    await this.tenantsService.update(tenantId, { config: updatedConfig });

    await this.tryLogAudit({
      adminId: this.getAdminId(ctx),
      action: 'sessionTemplate.delete',
      targetType: 'tenant',
      targetId: tenant.id,
      tenantId: tenant.id,
      metadata: { templateName: name, deletedTemplate },
    });

    return { message: `Session template "${name}" deleted` };
  }

  /**
   * POST /api/v1/admin/tenants/:tenantId/session-templates/sync
   *
   * Bulk-upsert session templates from solution.json or external callers.
   * Never deletes existing templates — only adds or updates the provided ones.
   * sessionTtlMs is capped at the tenant's plan maximum.
   */
  @Post('sync')
  @ApiOperation({ summary: 'Bulk-sync session templates (upsert, never deletes)' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  async syncTemplates(
    @Param('tenantId') tenantId: string,
    @Body() dto: SyncSessionTemplatesBodyDto,
    @Ctx() ctx: RequestContext,
  ) {
    const tenant = await this.findTenantOrThrow(tenantId);
    const existing = this.getTemplates(tenant);

    // MAJOR-1: Validate each template body individually (class-validator cannot
    // recurse into Record values, so we do it programmatically).
    for (const [name, raw] of Object.entries(dto.templates)) {
      const instance = plainToInstance(SessionTemplateBodyDto, raw);
      try {
        await validateOrReject(instance, { whitelist: true, forbidNonWhitelisted: false });
      } catch (errors) {
        throw new BadRequestException(
          `Template "${name}" failed validation: ${JSON.stringify(errors)}`,
        );
      }
    }

    // MAJOR-2: Enforce template count limit.
    const totalAfterSync = new Set([
      ...Object.keys(existing),
      ...Object.keys(dto.templates),
    ]).size;
    if (totalAfterSync > MAX_TEMPLATES_PER_TENANT) {
      throw new BadRequestException(
        `Sync would result in ${totalAfterSync} templates, exceeding the maximum of ${MAX_TEMPLATES_PER_TENANT}`,
      );
    }

    const synced = await this.tenantsService.syncSessionTemplates(
      tenantId,
      dto.templates as Record<string, Record<string, unknown>>,
    );

    // MAJOR-3: Audit log consistent with other mutating endpoints.
    await this.tryLogAudit({
      adminId: this.getAdminId(ctx),
      action: 'sessionTemplate.sync',
      targetType: 'tenant',
      targetId: tenant.id,
      tenantId: tenant.id,
      metadata: { templateNames: Object.keys(dto.templates), count: synced },
    });

    return { synced };
  }

  /**
   * POST /api/v1/admin/tenants/:tenantId/session-templates/:name/preview
   *
   * Preview template resolution with optional explicit params
   */
  @Post(':name/preview')
  @ApiOperation({
    summary: 'Preview template resolution with optional explicit params',
  })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiParam({ name: 'name', description: 'Template name' })
  async previewTemplate(
    @Param('tenantId') tenantId: string,
    @Param('name') name: string,
    @Body() dto: PreviewTemplateDto,
  ) {
    const tenant = await this.findTenantOrThrow(tenantId);
    const templates = this.getTemplates(tenant);
    const template = this.getTemplateOrThrow(templates, name);

    // Simulate parameter merging logic (same as react-sdk)
    const resolved = {
      enabledSkills:
        dto.explicitParams?.enabledSkills || template.enabledSkills,
      mcpServers: {
        ...(template.mcpServers || {}),
        ...(dto.explicitParams?.mcpServers || {}),
      },
      appendSystemPrompt: [
        template.appendSystemPrompt,
        dto.explicitParams?.appendSystemPrompt,
      ]
        .filter(Boolean)
        .join('\n\n') || undefined,
    };

    return { template, resolved };
  }
}
