import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TemplateBlockDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  content?: Record<string, any>;

  @IsOptional()
  is_required?: boolean;

  sort_order: number;
}

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  lesson_type?: string;

  @IsOptional()
  @IsArray()
  subject_ids?: string[];

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateBlockDto)
  blocks?: TemplateBlockDto[];

  @IsOptional()
  @IsString()
  user_id?: string;
}
