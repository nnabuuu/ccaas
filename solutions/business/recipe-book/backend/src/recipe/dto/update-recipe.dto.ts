import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class UpdateRecipeDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  cuisine?: string;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsNumber()
  @IsOptional()
  prep_time?: number;

  @IsNumber()
  @IsOptional()
  cook_time?: number;

  @IsNumber()
  @IsOptional()
  servings?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsArray()
  @IsOptional()
  blocks?: any[];
}
