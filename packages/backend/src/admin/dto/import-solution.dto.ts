/**
 * Import Solution DTO
 *
 * Body-based solution import — registers tenant config (MCP servers, session templates, bundles).
 * Skills are registered separately via the Skills API.
 */

import { IsString, IsOptional, IsIn, IsUrl, ValidateNested } from 'class-validator';
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

  /**
   * agent-runtime sync layer — REST base URL ccaas calls back to for
   * artifact load/save (e.g. `http://localhost:3007/api`). Persisted
   * to `tenant.config.artifactUrl`; read by ProjectArtifactSourceRegistry.
   * Mutable at runtime via `PUT /tenants/:id`.
   */
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  artifactUrl?: string;
}
