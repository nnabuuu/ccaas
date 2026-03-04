import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsIn,
} from 'class-validator';

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @IsIn(['completed', 'failed', 'cancelled'])
  status?: 'completed' | 'failed' | 'cancelled';

  @IsOptional()
  @IsString()
  resultText?: string;

  @IsOptional()
  @IsArray()
  resultFiles?: { name: string; path: string; size: number; mimeType: string }[];

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsObject()
  progress?: { step: string; percent: number };

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
