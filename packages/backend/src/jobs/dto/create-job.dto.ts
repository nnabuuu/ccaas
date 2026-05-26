import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  solutionId: string;

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
  enabledSkills?: string[];

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

  @IsOptional()
  @IsBoolean()
  trackingOnly?: boolean;
}
