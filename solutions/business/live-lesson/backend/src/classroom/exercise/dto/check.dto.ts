import { IsString, IsObject } from 'class-validator';

export class CheckDto {
  @IsString()
  studentId: string;

  @IsObject()
  data: Record<string, unknown>;
}
