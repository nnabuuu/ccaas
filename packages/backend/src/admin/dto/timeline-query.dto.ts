/**
 * Timeline Query DTO
 *
 * Validates session timeline pagination parameters
 */

import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class TimelineQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'limit must be at least 1' })
  @Max(1000, { message: 'limit cannot exceed 1000' })
  limit?: number = 100;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'offset must be non-negative' })
  offset?: number = 0;
}
