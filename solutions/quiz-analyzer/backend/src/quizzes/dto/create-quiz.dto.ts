import { IsString, IsOptional, IsNumber, Min, Max, IsArray } from 'class-validator';

export class CreateQuizDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  content_html?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  image_urls?: string[];

  @IsString()
  subject_id: string;

  @IsOptional()
  @IsString()
  grade_level?: string;

  @IsOptional()
  @IsString()
  quiz_type?: string; // 选择题, 填空题, 解答题, 证明题

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  chapter_reference?: string;

  @IsOptional()
  @IsString()
  correct_answer?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  answer_options?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledge_point_ids?: string[];
}
