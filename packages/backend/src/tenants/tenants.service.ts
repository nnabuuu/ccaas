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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';

@Injectable()
export class TenantsService implements OnModuleInit {
  private readonly logger = new Logger(TenantsService.name);
  private readonly defaultTenantId: string;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly configService: ConfigService,
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
      await this.create({
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
  async create(dto: CreateTenantDto): Promise<Tenant> {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check for duplicate slug
    const existing = await this.tenantRepository.findOne({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Tenant with slug '${slug}' already exists`);
    }

    const tenant = this.tenantRepository.create({
      name: dto.name,
      slug,
      description: dto.description,
      config: dto.config || {},
      maxSessions: dto.maxSessions || 100,
      maxSkills: dto.maxSkills || 50,
      plan: dto.plan || 'free',
      billingEmail: dto.billingEmail,
      status: 'active',
    });

    const saved = await this.tenantRepository.save(tenant);
    this.logger.log(`Created tenant ${saved.name} (${saved.slug})`);
    return saved;
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

    const saved = await this.tenantRepository.save(tenant);
    this.logger.log(`Updated tenant ${saved.name} (${saved.slug})`);
    return saved;
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
}
