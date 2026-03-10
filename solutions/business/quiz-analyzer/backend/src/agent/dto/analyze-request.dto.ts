import { IsString, IsOptional, IsObject, Matches, MaxLength } from 'class-validator';

export class AnalyzeRequestDto {
  @IsString()
  @MaxLength(100_000, { message: 'Message exceeds maximum length' })
  message: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'sessionId must contain only alphanumeric characters, hyphens, and underscores',
  })
  sessionId?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
