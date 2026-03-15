/**
 * Import Solution DTO
 *
 * Body-based solution import — registers tenant config (MCP servers, session templates, bundles).
 * Skills are registered separately via the Skills API.
 */

import { IsString, IsOptional, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { McpServerDefinition, SessionTemplateConfig } from '../../solutions/dto/solution-config.dto';

export class ImportSolutionTenantDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ImportSolutionDto {
  @ValidateNested()
  @Type(() => ImportSolutionTenantDto)
  tenant!: ImportSolutionTenantDto;

  @IsOptional()
  @IsIn(['simple', 'advanced'])
  mode?: 'simple' | 'advanced';

  @IsOptional()
  mcpServers?: Record<string, McpServerDefinition>;

  @IsOptional()
  sessionTemplates?: Record<string, SessionTemplateConfig>;
}
