import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DifficultyAnalysisDto } from './difficulty-analysis.dto';

// Knowledge Point Tag DTO
export class KnowledgePointTagDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsBoolean()
  verified: boolean;

  @IsNumber()
  level: number;

  @IsArray()
  @IsString({ each: true })
  path: string[];

  @IsString()
  source: 'question' | 'solution' | 'both';

  @IsOptional()
  @IsString()
  note?: string;
}

// Solution Step DTO
export class SolutionStepDto {
  @IsNumber()
  stepNumber: number;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  formula?: string;

  @IsString()
  reasoning: string;

  @IsArray()
  @IsString({ each: true })
  commonErrors: string[];
}

// Common Mistake DTO
export class CommonMistakeDto {
  @IsString()
  description: string;

  @IsString()
  frequency: 'high' | 'medium' | 'low';

  @IsArray()
  @IsString({ each: true })
  knowledgeGaps: string[];

  @IsString()
  remediation: string;
}

// Related Quiz DTO
export class RelatedQuizDto {
  @IsString()
  id: string;

  @IsString()
  content: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  similarity: number;

  @IsString()
  similarityReason: string;

  @IsArray()
  @IsString({ each: true })
  matchedKnowledgePoints: string[];
}

// Main Quiz Analysis DTO
export class QuizAnalysisDto {
  @IsOptional()
  @IsString()
  quizAnalysis?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KnowledgePointTagDto)
  knowledgePointTags?: KnowledgePointTagDto[];

  @IsOptional()
  @IsString()
  thinkingProcess?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SolutionStepDto)
  solutionSteps?: SolutionStepDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommonMistakeDto)
  commonMistakes?: CommonMistakeDto[];

  @IsOptional()
  @IsString()
  knowledgeGapAnalysis?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DifficultyAnalysisDto)
  difficultyAnalysis?: DifficultyAnalysisDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RelatedQuizDto)
  relatedQuizzes?: RelatedQuizDto[];
}
