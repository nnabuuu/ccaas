import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TemplateBlockDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @IsNumber()
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

  /** Frontend sends display name (e.g. '数学'), resolved to subject_ids in service */
  @IsOptional()
  @IsString()
  subject?: string;

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
