import { IsString, IsInt, IsUUID, Min, Max, MaxLength, IsNotEmpty } from 'class-validator';

export class TranslateChatDto {
  @IsUUID()
  studentId: string;

  @IsInt()
  @Min(0)
  @Max(100)
  step: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  originalText: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sourceContext: string;
}
