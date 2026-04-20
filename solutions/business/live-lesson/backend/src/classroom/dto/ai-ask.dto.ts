import { IsString, IsInt, Min, Max, MaxLength } from 'class-validator';

export class AiAskDto {
  @IsString()
  studentId: string;

  @IsString()
  @MaxLength(500)
  question: string;

  @IsInt()
  @Min(0)
  @Max(4)
  step: number;
}
