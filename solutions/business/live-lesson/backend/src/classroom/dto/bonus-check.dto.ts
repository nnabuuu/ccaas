import { IsUUID, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

const MAX_DATA_SIZE = 10_000;

export class BonusCheckDto {
  @IsUUID()
  studentId: string;

  @IsObject()
  @Transform(({ value }) => {
    if (JSON.stringify(value).length > MAX_DATA_SIZE) {
      throw new Error('Bonus check data too large');
    }
    return value;
  })
  data: Record<string, unknown>;
}
