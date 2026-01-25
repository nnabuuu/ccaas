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
} from 'class-validator';
import type { TenantPlan, TenantStatus } from '../entities/tenant.entity';

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
}
