import { IsUUID, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

const MAX_DATA_SIZE = 10_000;

export class BonusCheckDto {
  @IsUUID()
  studentId: string;

  @IsObject()
  @Transform(({ value }) => {
    if (JSON.stringify(value).length > MAX_DATA_SIZE) {
      throw new BadRequestException('Bonus check data too large');
    }
    return value;
  })
  data: Record<string, unknown>;
}
