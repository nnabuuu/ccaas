import { IsString, IsOptional } from 'class-validator';

export class ReviewPromotionDto {
  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
