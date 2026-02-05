import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsNumber,
  IsIn,
  Min,
} from 'class-validator';

export class CreateScheduledTaskDto {
  @IsString()
  tenantId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  message: string;

  @IsIn(['cron', 'interval', 'once'])
  scheduleType: 'cron' | 'interval' | 'once';

  @IsString()
  scheduleValue: string;

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
  maxConcurrent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxRetries?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  retryDelayMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(10000)
  timeoutMs?: number;
}
