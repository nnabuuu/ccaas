import { IsString, IsInt, IsObject, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

const MAX_DATA_SIZE = 10_000; // 10 KB JSON limit

export class SubmitDto {
  @IsString()
  studentId: string;

  @IsInt()
  @Min(0)
  @Max(20)
  step: number;

  @IsObject()
  @Transform(({ value }) => {
    if (JSON.stringify(value).length > MAX_DATA_SIZE) {
      throw new BadRequestException('Submission data too large');
    }
    return value;
  })
  data: Record<string, any>;
}
