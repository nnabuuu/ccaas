/**
 * API Key Service
 *
 * Manages API keys for tenant authentication with hashing and rate limiting.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ApiKey } from './entities/api-key.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantsService } from '../tenants/tenants.service';
import { UserTenantService } from '../users/user-tenant.service';
import type {
  ApiKeyScope,
  RateLimitEntry,
  RequestContext,
} from './types';
import {
  API_KEY_PREFIX,
  DEFAULT_SCOPES,
} from './types';
import {
  SessionExpiredException,
  RateLimitedException,
} from '../protocol/http-exceptions';
import type {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  CreateApiKeyResponse,
  ApiKeyResponse,
} from './dto/api-key.dto';

@Injectable()
export class ApiKeyService implements OnModuleInit {
  private readonly logger = new Logger(ApiKeyService.name);
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private readonly enableRateLimiting: boolean;
  private readonly allowAnonymous: boolean;

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @Inject(forwardRef(() => TenantsService))
    private readonly tenantsService: TenantsService,
    private readonly userTenantService: UserTenantService,
    private readonly configService: ConfigService,
  ) {
    this.enableRateLimiting = this.configService.get('auth.enableRateLimiting', true);
    this.allowAnonymous = this.configService.get('auth.allowAnonymous', true);
  }

  async onModuleInit() {
    // Ensure default tenant has an API key
    const defaultTenantId = this.tenantsService.getDefaultTenantId();
    const defaultTenant = await this.tenantsService.findOne(defaultTenantId);

    if (defaultTenant) {
      const keys = await this.findByTenantId(defaultTenant.id);
      if (keys.length === 0) {
        const { rawKey } = await this.create(defaultTenant.id, {
          name: 'Default Development Key',
          scopes: ['skills:read', 'skills:write', 'skills:execute', 'skills:delete', 'chat', 'admin'],
        });
        this.logger.log(`Created default API key: ${rawKey.substring(0, 20)}...`);
        this.logger.log(`Save this key - it won't be shown again!`);
      }
    }
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Create a new API key for a tenant
   */
  async create(tenantId: string, dto: CreateApiKeyDto): Promise<CreateApiKeyResponse> {
    const tenant = await this.tenantsService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    // Generate raw key with prefix
    const rawKey = this.generateRawKey(tenant.slug);
    const keyHash = this.hashKey(rawKey);

    const apiKey = this.apiKeyRepository.create({
      tenantId: tenant.id,
      name: dto.name,
      keyHash,
      keyPrefix: rawKey.substring(0, 16),
      scopes: dto.scopes || DEFAULT_SCOPES,
      rateLimitRpm: dto.rateLimitRpm || 60,
      rateLimitRpd: dto.rateLimitRpd || 10000,
      status: 'active',
      expiresAt: dto.expiresAt || null,
      metadata: dto.metadata || null,
    });

    const saved = await this.apiKeyRepository.save(apiKey);
    this.logger.log(`Created API key for tenant ${tenant.slug}: ${saved.keyPrefix}...`);

    return {
      apiKey: {
        id: saved.id,
        name: saved.name,
        keyPrefix: saved.keyPrefix,
        scopes: saved.scopes,
        rateLimitRpm: saved.rateLimitRpm,
        rateLimitRpd: saved.rateLimitRpd,
        status: saved.status,
        expiresAt: saved.expiresAt,
        createdAt: saved.createdAt,
      },
      rawKey,
    };
  }

  /**
   * Find API keys for a tenant
   */
  async findByTenantId(tenantId: string): Promise<ApiKeyResponse[]> {
    const keys = await this.apiKeyRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    return keys.map(this.toResponse);
  }

  /**
   * Find an API key by ID
   */
  async findById(id: string): Promise<ApiKeyResponse | null> {
    const key = await this.apiKeyRepository.findOne({ where: { id } });
    return key ? this.toResponse(key) : null;
  }

  /**
   * Update an API key
   */
  async update(id: string, dto: UpdateApiKeyDto): Promise<ApiKeyResponse> {
    const key = await this.apiKeyRepository.findOne({ where: { id } });
    if (!key) {
      throw new NotFoundException(`API key not found: ${id}`);
    }

    if (dto.name !== undefined) key.name = dto.name;
    if (dto.scopes !== undefined) key.scopes = dto.scopes;
    if (dto.rateLimitRpm !== undefined) key.rateLimitRpm = dto.rateLimitRpm;
    if (dto.rateLimitRpd !== undefined) key.rateLimitRpd = dto.rateLimitRpd;
    if (dto.status !== undefined) key.status = dto.status;
    if (dto.expiresAt !== undefined) key.expiresAt = dto.expiresAt;
    if (dto.metadata !== undefined) key.metadata = dto.metadata;

    const saved = await this.apiKeyRepository.save(key);
    this.logger.log(`Updated API key: ${saved.id}`);

    return this.toResponse(saved);
  }

  /**
   * Revoke an API key
   */
  async revoke(id: string): Promise<void> {
    await this.update(id, { status: 'revoked' });
    this.logger.log(`Revoked API key: ${id}`);
  }

  /**
   * Delete an API key
   */
  async delete(id: string): Promise<void> {
    const result = await this.apiKeyRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`API key not found: ${id}`);
    }
    this.logger.log(`Deleted API key: ${id}`);
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Validate an API key and return the tenant context
   */
  async validateKey(rawKey: string): Promise<{ apiKey: ApiKey; tenant: Tenant }> {
    if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
      throw new SessionExpiredException('Invalid API key format');
    }

    const keyHash = this.hashKey(rawKey);
    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyHash },
      relations: ['tenant', 'user'],
    });

    if (!apiKey) {
      throw new SessionExpiredException('Invalid API key');
    }

    if (apiKey.status !== 'active') {
      throw new SessionExpiredException(`API key is ${apiKey.status}`);
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      throw new SessionExpiredException('API key has expired');
    }

    if (!apiKey.tenant || apiKey.tenant.status !== 'active') {
      throw new SessionExpiredException('Tenant is not active');
    }

    // Update last used
    apiKey.lastUsedAt = new Date();
    apiKey.usageCount++;
    await this.apiKeyRepository.save(apiKey);

    return { apiKey, tenant: apiKey.tenant };
  }

  /**
   * Create request context from API key or anonymous access
   */
  async createContext(rawKey?: string): Promise<RequestContext> {
    const requestId = crypto.randomUUID();
    const timestamp = new Date();

    if (rawKey) {
      const { apiKey, tenant } = await this.validateKey(rawKey);

      // Check rate limit
      if (this.enableRateLimiting) {
        this.checkRateLimit(apiKey);
      }

      // Resolve user if API key has userId
      let user = apiKey.user;
      let userTenant = undefined;

      if (apiKey.userId && user) {
        userTenant = await this.userTenantService.findUserInTenant(apiKey.userId, tenant.id);

        // Check if user is active in this tenant
        if (!userTenant || !userTenant.isActive) {
          throw new SessionExpiredException('User is not active in this tenant');
        }
      }

      return {
        tenantId: tenant.id,
        tenant,
        apiKeyId: apiKey.id,
        apiKeyScopes: apiKey.scopes,
        userId: apiKey.userId || undefined,
        user: user || undefined,
        userTenant: userTenant || undefined,
        requestId,
        timestamp,
        isAnonymous: false,
      };
    }

    // Anonymous access
    if (!this.allowAnonymous) {
      throw new SessionExpiredException('API key required');
    }

    const defaultTenantId = this.tenantsService.getDefaultTenantId();
    const tenant = await this.tenantsService.findOne(defaultTenantId);

    if (!tenant) {
      throw new SessionExpiredException('No default tenant available');
    }

    return {
      tenantId: tenant.id,
      tenant,
      requestId,
      timestamp,
      isAnonymous: true,
    };
  }

  // ==========================================================================
  // Rate Limiting
  // ==========================================================================

  /**
   * Check if API key has exceeded rate limit
   */
  checkRateLimit(apiKey: ApiKey): void {
    const entry = this.rateLimits.get(apiKey.id);
    const now = Date.now();

    if (!entry || entry.resetAt < now) {
      // Start new window
      this.rateLimits.set(apiKey.id, {
        count: 1,
        resetAt: now + 60000, // 1 minute window
      });
      return;
    }

    entry.count++;

    if (entry.count > apiKey.rateLimitRpm) {
      const retryAfter = entry.resetAt - now;
      throw new RateLimitedException(retryAfter);
    }
  }

  /**
   * Get rate limit status for an API key
   */
  getRateLimitStatus(apiKeyId: string, rateLimit: number = 60): { remaining: number; resetAt: number } | null {
    const entry = this.rateLimits.get(apiKeyId);
    if (!entry) return null;

    return {
      remaining: Math.max(0, rateLimit - entry.count),
      resetAt: entry.resetAt,
    };
  }

  // ==========================================================================
  // Scope Checking
  // ==========================================================================

  /**
   * Check if scopes include required scope
   */
  hasScope(scopes: ApiKeyScope[] | undefined, requiredScope: ApiKeyScope): boolean {
    if (!scopes) return false;
    // Admin has all permissions
    if (scopes.includes('admin')) return true;
    return scopes.includes(requiredScope);
  }

  /**
   * Check if scopes include all required scopes
   */
  hasAllScopes(scopes: ApiKeyScope[] | undefined, requiredScopes: ApiKeyScope[]): boolean {
    if (!scopes) return false;
    // Admin has all permissions
    if (scopes.includes('admin')) return true;
    return requiredScopes.every((s) => scopes.includes(s));
  }

  /**
   * Check if scopes include any of the required scopes
   */
  hasAnyScope(scopes: ApiKeyScope[] | undefined, requiredScopes: ApiKeyScope[]): boolean {
    if (!scopes) return false;
    // Admin has all permissions
    if (scopes.includes('admin')) return true;
    return requiredScopes.some((s) => scopes.includes(s));
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private generateRawKey(tenantSlug: string): string {
    const prefix = tenantSlug.substring(0, 8).padEnd(8, 'x');
    const random = crypto.randomBytes(24).toString('base64url');
    return `${API_KEY_PREFIX}${prefix}-${random}`;
  }

  private hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  private toResponse(key: ApiKey): ApiKeyResponse {
    return {
      id: key.id,
      tenantId: key.tenantId,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      rateLimitRpm: key.rateLimitRpm,
      rateLimitRpd: key.rateLimitRpd,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      status: key.status,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    };
  }
}
