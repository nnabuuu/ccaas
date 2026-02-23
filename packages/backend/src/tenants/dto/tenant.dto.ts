/**
 * Tenant DTOs
 *
 * Data transfer objects for tenant-related operations.
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsInt,
  Min,
  IsEmail,
  IsBoolean,
} from 'class-validator';
import type { TenantPlan, TenantStatus, Tenant } from '../entities/tenant.entity';
import type { ApiKeyScope } from '../../auth/types';

/**
 * Create tenant request
 */
export class CreateTenantDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSessions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSkills?: number;

  @IsOptional()
  @IsEnum(['free', 'starter', 'professional', 'enterprise'])
  plan?: TenantPlan;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsBoolean()
  autoCreateApiKey?: boolean;

  @IsOptional()
  @IsInt()
  @Min(60000)
  sessionTtlMs?: number;
}

/**
 * Update tenant request
 */
export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSessions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSkills?: number;

  @IsOptional()
  @IsEnum(['free', 'starter', 'professional', 'enterprise'])
  plan?: TenantPlan;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsEnum(['active', 'suspended', 'pending', 'deleted'])
  status?: TenantStatus;

  @IsOptional()
  @IsInt()
  @Min(60000)
  sessionTtlMs?: number;
}

/**
 * Create tenant response
 *
 * When autoCreateApiKey is true, includes API key data.
 */
export interface CreateTenantResponse {
  id: string; // Convenience property - same as tenant.id
  tenant: Tenant;
  apiKey?: {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: ApiKeyScope[];
    rateLimitRpm: number;
    rateLimitRpd: number;
    status: string;
    expiresAt: Date | null;
    createdAt: Date;
  };
  rawKey?: string;
  warning?: string;
}
