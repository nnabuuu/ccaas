import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdateLessonPlanDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subject_id?: string;

  @IsOptional()
  @IsString()
  class_id?: string;

  /** Frontend sends display name (e.g. '数学') */
  @IsOptional()
  @IsString()
  subject?: string;

  /** Frontend sends display name (e.g. '八(2)班') */
  @IsOptional()
  @IsString()
  class_name?: string;

  @IsOptional()
  @IsString()
  lesson_type?: string;

  @IsOptional()
  @IsNumber()
  duration_minutes?: number;

  /** Frontend alias for duration_minutes */
  @IsOptional()
  @IsNumber()
  duration?: number;
}
