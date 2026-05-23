import { IsString, IsObject, IsOptional } from 'class-validator';

export class CheckDto {
  @IsString()
  studentId: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsString()
  @IsOptional()
  exerciseType?: string;
}
