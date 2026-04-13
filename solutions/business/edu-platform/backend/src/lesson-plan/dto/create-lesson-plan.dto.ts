import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateLessonPlanDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  subject_id?: string;

  @IsOptional()
  @IsString()
  class_id?: string;

  /** Frontend sends display name (e.g. '数学'), resolved to subject_id in service */
  @IsOptional()
  @IsString()
  subject?: string;

  /** Frontend sends display name (e.g. '八(2)班'), resolved to class_id in service */
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

  @IsOptional()
  @IsString()
  source_template_id?: string;

  @IsOptional()
  @IsString()
  requirement_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;
}
