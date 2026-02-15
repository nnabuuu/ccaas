import { IsString, IsOptional, IsObject, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { SessionTemplate } from '@ccaas/common';

export class CreateSessionTemplateDto {
  @ApiProperty({
    description: 'Template name (lowercase alphanumeric with hyphens/underscores)',
    example: 'teacher-analysis',
  })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]*$/, {
    message: 'Template name must match pattern: [a-z0-9][a-z0-9_-]*',
  })
  name!: string;

  @ApiProperty({
    description: 'Session Template configuration',
    example: {
      description: 'Teacher view - full analysis features',
      appendSystemPrompt: 'You are an educational analyst...',
      enabledSkillSlugs: ['knowledge-matching', 'analysis'],
    },
  })
  @IsObject()
  template!: SessionTemplate;
}

export class UpdateSessionTemplateDto {
  @ApiProperty({ description: 'Updated template configuration' })
  @IsObject()
  template!: SessionTemplate;
}

export class PreviewTemplateDto {
  @ApiProperty({
    description: 'Explicit parameters to test merging',
    required: false,
  })
  @IsOptional()
  @IsObject()
  explicitParams?: {
    enabledSkillSlugs?: string[];
    mcpServers?: Record<string, unknown>;
    appendSystemPrompt?: string;
  };
}
