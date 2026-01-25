/**
 * Skill DTOs
 *
 * Data transfer objects for skill-related operations.
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import type { SkillType, SkillStatus } from '../entities/skill.entity';

/**
 * Create skill request
 */
export class CreateSkillDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(['skill', 'sub-agent'])
  type?: SkillType;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTools?: string[];

  @IsOptional()
  @IsArray()
  triggers?: Array<{
    type: 'keyword' | 'intent' | 'pattern' | 'context';
    value: string;
    priority?: number;
    description?: string;
  }>;
}

/**
 * Update skill request
 */
export class UpdateSkillDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedTools?: string[];

  @IsOptional()
  @IsArray()
  triggers?: Array<{
    type: 'keyword' | 'intent' | 'pattern' | 'context';
    value: string;
    priority?: number;
    description?: string;
  }>;

  @IsOptional()
  @IsBoolean()
  createVersion?: boolean;
}

/**
 * List skills query
 */
export class ListSkillsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['draft', 'review', 'published', 'deprecated', 'archived'])
  status?: SkillStatus;

  @IsOptional()
  @IsEnum(['skill', 'sub-agent'])
  type?: SkillType;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['name', 'createdAt', 'updatedAt'])
  sortBy?: 'name' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

/**
 * Create version request
 */
export class CreateVersionDto {
  @IsOptional()
  @IsString()
  changelog?: string;

  @IsOptional()
  @IsEnum(['major', 'minor', 'patch'])
  bumpType?: 'major' | 'minor' | 'patch';

  @IsOptional()
  @IsString()
  version?: string;
}
