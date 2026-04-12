import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateLessonPlanDto {
  @IsString()
  title: string;

  @IsString()
  subject_id: string;

  @IsString()
  class_id: string;

  @IsOptional()
  @IsString()
  lesson_type?: string;

  @IsOptional()
  @IsNumber()
  duration_minutes?: number;

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
