import { IsString, IsOptional, IsIn } from 'class-validator';

export class ReviewPromotionDto {
  @IsIn(['approve', 'reject', 'revision_requested'])
  action: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
