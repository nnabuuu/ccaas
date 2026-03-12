import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsInt,
  Min,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class McpServerConfigDto {
  @IsString()
  command!: string;

  @IsArray()
  @IsString({ each: true })
  args!: string[];

  @IsOptional()
  @IsString()
  description?: string;
}

export class SessionTemplateBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  appendSystemPrompt?: string;

  @IsOptional()
  @IsArray()
  enabledSkills?: Array<string | { slug: string; promptMode?: 'protocol' | 'inline' }>;

  // Note: @IsObject() validates that mcpServers is an object, but class-validator
  // cannot validate Record values automatically. McpServerConfigDto serves as
  // documentation and TypeScript type-checking for consumers.
  @IsOptional()
  @IsObject()
  mcpServers?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  model?: string;

  @IsOptional()
  @IsString()
  skillPath?: string;

  @IsOptional()
  @IsInt()
  @Min(60000)
  sessionTtlMs?: number;
}

export class CreateSessionTemplateDto {
  @ApiProperty({
    description: 'Template name (lowercase alphanumeric with hyphens/underscores, max 64 chars)',
    example: 'teacher-analysis',
  })
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9][a-z0-9_-]*$/, {
    message: 'Template name must match pattern: [a-z0-9][a-z0-9_-]*',
  })
  name!: string;

  @ApiProperty({
    description: 'Session Template configuration',
    example: {
      description: 'Teacher view - full analysis features',
      appendSystemPrompt: 'You are an educational analyst...',
      enabledSkills: ['knowledge-matching', 'analysis'],
    },
  })
  @ValidateNested()
  @Type(() => SessionTemplateBodyDto)
  template!: SessionTemplateBodyDto;
}

export class UpdateSessionTemplateDto {
  @ApiProperty({ description: 'Updated template configuration' })
  @ValidateNested()
  @Type(() => SessionTemplateBodyDto)
  template!: SessionTemplateBodyDto;
}

export class PreviewTemplateDto {
  @ApiProperty({
    description: 'Explicit parameters to test merging',
    required: false,
  })
  @IsOptional()
  @IsObject()
  explicitParams?: {
    enabledSkills?: string[];
    mcpServers?: Record<string, unknown>;
    appendSystemPrompt?: string;
  };
}

/**
 * Body for POST .../sync — bulk-upsert templates from solution.json or CI pipelines.
 *
 * Note: class-validator does not support @ValidateNested on Record values (only arrays).
 * The controller validates each template value programmatically via plainToInstance +
 * validateOrReject to ensure SessionTemplateBodyDto constraints are enforced.
 */
export class SyncSessionTemplatesBodyDto {
  @ApiProperty({
    description: 'Record of template name → template body',
    example: {
      teacher: { description: 'Teacher view', enabledSkills: ['analysis'] },
    },
  })
  @IsObject()
  templates!: Record<string, SessionTemplateBodyDto>;
}
