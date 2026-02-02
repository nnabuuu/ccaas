/**
 * UpdateLessonPlanDto
 *
 * DTO for updating an existing lesson plan.
 */

import { IsString, IsOptional, IsArray, IsObject, IsIn } from 'class-validator';
import type {
  LessonPlanStatus,
  LearningObjective,
  Standard,
  Material,
  Activity,
  Assessment,
  Differentiation,
} from '@ccaas/common';

export class UpdateLessonPlanDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @IsOptional()
  @IsString()
  duration?: string;

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
  @IsIn(['draft', 'review', 'published'])
  status?: LessonPlanStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // Note: tenantId is not allowed to be updated
  tenantId?: never;
}
