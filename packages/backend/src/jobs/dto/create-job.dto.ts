import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  tenantId: string;

  @IsString()
  type: string;

  @IsString()
  name: string;

  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsObject()
  mcpServers?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledSkillSlugs?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsNumber()
  @Min(10000)
  timeoutMs?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
