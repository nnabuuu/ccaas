import { IsString, IsInt, Min, Max, MaxLength, IsOptional, IsNotEmpty } from 'class-validator';

export class TranslateDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text: string;

  @IsInt()
  @Min(0)
  @Max(100)
  step: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sourceContext: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phase?: string;
}
