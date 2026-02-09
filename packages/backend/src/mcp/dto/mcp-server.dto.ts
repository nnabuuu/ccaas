/**
 * MCP Server DTOs
 *
 * Data Transfer Objects for MCP Server API endpoints.
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { McpServerType, McpServerStatus, McpServerConfig } from '../types';

/**
 * Create MCP Server DTO
 */
export class CreateMcpServerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['builtin', 'custom', 'rest-adapter', 'stdio'])
  type!: McpServerType | 'stdio';

  @IsObject()
  config!: McpServerConfig;

  @IsEnum(['active', 'disabled', 'error'])
  @IsOptional()
  status?: McpServerStatus;
}

/**
 * Update MCP Server DTO
 */
export class UpdateMcpServerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  config?: McpServerConfig;

  @IsEnum(['active', 'disabled'])
  @IsOptional()
  status?: 'active' | 'disabled';
}

/**
 * List MCP Servers Query DTO
 */
export class ListMcpServersDto {
  @IsNumber()
  @Min(1)
  @Max(250)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsEnum(['builtin', 'custom', 'rest-adapter', 'stdio'])
  @IsOptional()
  type?: McpServerType | 'stdio';

  @IsEnum(['active', 'disabled', 'error'])
  @IsOptional()
  status?: McpServerStatus;

  @IsString()
  @IsOptional()
  query?: string;
}
