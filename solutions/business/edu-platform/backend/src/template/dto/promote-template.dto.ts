import { IsString, IsOptional } from 'class-validator';

export class PromoteTemplateDto {
  @IsString()
  target_scope: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
