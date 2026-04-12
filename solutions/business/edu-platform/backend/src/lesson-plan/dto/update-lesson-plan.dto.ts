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

  @IsOptional()
  @IsString()
  lesson_type?: string;

  @IsOptional()
  @IsNumber()
  duration_minutes?: number;
}
