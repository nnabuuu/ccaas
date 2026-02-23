/**
 * Tenants Service
 *
 * Business logic for tenant management.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  Tenant,
  TenantPlan,
  PLAN_MAX_SESSION_TTL_MS,
  PLAN_DEFAULT_SESSION_TTL_MS,
} from './entities/tenant.entity';
import { CreateTenantDto, UpdateTenantDto, CreateTenantResponse } from './dto/tenant.dto';
import { ApiKeyService } from '../auth/api-key.service';
import { DEFAULT_SCOPES } from '../auth/types';

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);
  private readonly defaultTenantId: string;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => ApiKeyService))
    private readonly apiKeyService: ApiKeyService,
  ) {
    this.defaultTenantId = this.configService.get('skills.defaultTenantId', 'default');
  }

  /**
   * Ensure default tenant exists on startup
   */
  async onModuleInit() {
    const defaultTenant = await this.tenantRepository.findOne({
      where: { slug: this.defaultTenantId },
    });

    if (!defaultTenant) {
      const result = await this.create({
        name: 'Default Tenant',
        slug: this.defaultTenantId,
        description: 'Default tenant for development',
      });
      this.logger.log(`Created default tenant: ${this.defaultTenantId}`);
    }
  }

  /**
   * Create a new tenant
   */
  async create(dto: CreateTenantDto): Promise<CreateTenantResponse> {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check for duplicate slug
    const existing = await this.tenantRepository.findOne({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Tenant with slug '${slug}' already exists`);
    }

    const plan = dto.plan ?? 'free';
    const tenant = this.tenantRepository.create({
      name: dto.name,
      slug,
      description: dto.description,
      config: dto.config || {},
      maxSessions: dto.maxSessions || 100,
      maxSkills: dto.maxSkills || 50,
      plan,
      billingEmail: dto.billingEmail,
      status: 'active',
      sessionTtlMs: this.effectiveTtl(plan, dto.sessionTtlMs),
    });

    const saved = await this.tenantRepository.save(tenant);
    this.logger.log(`Created tenant ${saved.name} (${saved.slug})`);

    // Build response
    const response: CreateTenantResponse = {
      id: saved.id,
      tenant: saved,
    };

    // Auto-create API key if requested
    if (dto.autoCreateApiKey) {
      const apiKeyData = await this.apiKeyService.create(saved.id, {
        name: `Default API Key for ${saved.name}`,
        scopes: DEFAULT_SCOPES,
      });

      response.apiKey = apiKeyData.apiKey;
      response.rawKey = apiKeyData.rawKey;
      response.warning = 'This is the only time the raw API key will be displayed. Please save it securely.';

      this.logger.log(
        `Auto-created API key for tenant ${saved.slug}: ${apiKeyData.rawKey.substring(0, 20)}...`
      );
    }

    return response;
  }

  /**
   * Find all tenants
   */
  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find({
      where: { status: 'active' },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find a tenant by ID or slug
   */
  async findOne(idOrSlug: string): Promise<Tenant | null> {
    let tenant = await this.tenantRepository.findOne({
      where: { id: idOrSlug },
    });

    if (!tenant) {
      tenant = await this.tenantRepository.findOne({
        where: { slug: idOrSlug },
      });
    }

    return tenant;
  }


  /**
   * Update a tenant
   */
  async update(idOrSlug: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(idOrSlug);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${idOrSlug}`);
    }

    if (dto.name !== undefined) tenant.name = dto.name;
    if (dto.description !== undefined) tenant.description = dto.description;
    if (dto.config !== undefined) tenant.config = { ...tenant.config, ...dto.config };
    if (dto.maxSessions !== undefined) tenant.maxSessions = dto.maxSessions;
    if (dto.maxSkills !== undefined) tenant.maxSkills = dto.maxSkills;
    if (dto.plan !== undefined) tenant.plan = dto.plan;
    if (dto.billingEmail !== undefined) tenant.billingEmail = dto.billingEmail;
    if (dto.status !== undefined) tenant.status = dto.status;
    if (dto.sessionTtlMs !== undefined || dto.plan !== undefined) {
      const plan = dto.plan ?? tenant.plan;
      tenant.sessionTtlMs = this.effectiveTtl(plan, dto.sessionTtlMs ?? tenant.sessionTtlMs);
    }

    const saved = await this.tenantRepository.save(tenant);
    this.logger.log(`Updated tenant ${saved.name} (${saved.slug})`);
    return saved;
  }


  /**
   * Sync session templates from solution.json (upsert — never deletes existing templates).
   * Caps sessionTtlMs at the tenant's plan maximum.
   * Returns the number of templates synced.
   */
  async syncSessionTemplates(
    tenantId: string,
    templates: Record<string, Record<string, unknown>>,
  ): Promise<number> {
    const tenant = await this.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }
    const existing = (tenant.config?.sessionTemplates ?? {}) as Record<string, Record<string, unknown>>;
    const merged: Record<string, Record<string, unknown>> = { ...existing };
    const maxTtl = PLAN_MAX_SESSION_TTL_MS[tenant.plan];

    for (const [name, tmpl] of Object.entries(templates)) {
      const sessionTtlMs = (tmpl as any).sessionTtlMs as number | undefined;
      const capped = sessionTtlMs !== undefined
        ? { ...tmpl, sessionTtlMs: Math.min(sessionTtlMs, maxTtl) }
        : tmpl;
      merged[name] = capped;
    }

    await this.tenantRepository.save({
      ...tenant,
      config: { ...tenant.config, sessionTemplates: merged },
    });
    this.logger.log(`Synced ${Object.keys(templates).length} session templates for tenant ${tenantId}`);
    return Object.keys(templates).length;
  }

  /**
   * Get the default tenant ID
   */
  getDefaultTenantId(): string {
    return this.defaultTenantId;
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Get effective session TTL, capped by plan max
   */
  effectiveTtl(plan: TenantPlan, requested?: number): number {
    const max = PLAN_MAX_SESSION_TTL_MS[plan];
    const def = PLAN_DEFAULT_SESSION_TTL_MS[plan];
    if (requested === undefined) return def;
    return Math.min(requested, max);
  }
}
