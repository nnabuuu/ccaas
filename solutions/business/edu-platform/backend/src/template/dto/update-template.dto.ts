import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateBlockDto } from './create-template.dto';

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  lesson_type?: string;

  @IsOptional()
  @IsArray()
  subject_ids?: string[];

  /** Frontend sends display name (e.g. '数学') */
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateBlockDto)
  blocks?: TemplateBlockDto[];
}
