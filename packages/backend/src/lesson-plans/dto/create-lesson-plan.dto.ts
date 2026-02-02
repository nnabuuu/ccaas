/**
 * CreateLessonPlanDto
 *
 * DTO for creating a new lesson plan.
 */

import { IsString, IsOptional, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import type {
  LearningObjective,
  Standard,
  Material,
  Activity,
  Assessment,
  Differentiation,
} from '@ccaas/common';

export class CreateLessonPlanDto {
  @IsString()
  title: string;

  @IsString()
  subject: string;

  @IsString()
  gradeLevel: string;

  @IsString()
  duration: string;

  @IsOptional()
  @IsArray()
  objectives?: LearningObjective[];

  @IsOptional()
  @IsArray()
  standards?: Standard[];

  @IsOptional()
  @IsArray()
  materials?: Material[];

  @IsOptional()
  @IsArray()
  activities?: Activity[];

  @IsOptional()
  @IsObject()
  assessment?: Assessment;

  @IsOptional()
  @IsObject()
  differentiation?: Differentiation;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
