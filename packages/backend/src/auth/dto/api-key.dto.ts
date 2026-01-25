/**
 * API Key DTOs
 *
 * Data transfer objects for API key management.
 */

import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsIn,
  IsDate,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ApiKeyScope, ApiKeyStatus, ApiKeyMetadata } from '../types';
import { ALL_SCOPES } from '../types';

export class CreateApiKeyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsIn(ALL_SCOPES, { each: true })
  scopes?: ApiKeyScope[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  rateLimitRpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000000)
  rateLimitRpd?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @IsOptional()
  metadata?: ApiKeyMetadata;
}

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsIn(ALL_SCOPES, { each: true })
  scopes?: ApiKeyScope[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  rateLimitRpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000000)
  rateLimitRpd?: number;

  @IsOptional()
  @IsIn(['active', 'revoked'] as ApiKeyStatus[])
  status?: ApiKeyStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @IsOptional()
  metadata?: ApiKeyMetadata;
}

/**
 * Response when creating an API key (includes raw key)
 */
export interface CreateApiKeyResponse {
  apiKey: {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: ApiKeyScope[];
    rateLimitRpm: number;
    rateLimitRpd: number;
    status: ApiKeyStatus;
    expiresAt: Date | null;
    createdAt: Date;
  };
  /** Raw key - only returned once at creation time */
  rawKey: string;
}

/**
 * API key in responses (without sensitive data)
 */
export interface ApiKeyResponse {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  rateLimitRpm: number;
  rateLimitRpd: number;
  lastUsedAt: Date | null;
  usageCount: number;
  status: ApiKeyStatus;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
