import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class CreateAnalysisDto {
  @IsString()
  quiz_id: string;

  @IsOptional()
  @IsString()
  thinking_process?: string;

  @IsOptional()
  @IsArray()
  solution_steps?: any[];

  @IsOptional()
  @IsArray()
  common_mistakes?: any[];

  @IsOptional()
  @IsString()
  knowledge_gap_analysis?: string;

  @IsOptional()
  difficulty_analysis?: any; // Will be JSON stringified

  @IsOptional()
  @IsString()
  analyzer_version?: string;

  @IsOptional()
  @IsNumber()
  analysis_duration_ms?: number;
}
